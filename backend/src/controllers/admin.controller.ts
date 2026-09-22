import { Request, Response } from "express";
import { z } from "zod";
// pdf-parse não tem types oficiais completos; import via require evita
// atrito com o modo de teste automático do próprio pacote no ESM/CJS misto.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { uploadReportPdf } from "../services/storage.service";

const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export async function listAdminProjects(_req: Request, res: Response) {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, description: true, pdfPath: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
}

export async function createProject(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "Envie o PDF do relatório no campo 'pdf'");
  const { title, description } = createProjectSchema.parse(req.body);

  const { text } = await pdfParse(req.file.buffer);
  if (!text?.trim()) {
    throw new HttpError(422, "Não foi possível extrair texto do PDF enviado");
  }

  const pdfPath = await uploadReportPdf(req.file.buffer, req.file.originalname);

  const project = await prisma.project.create({
    data: { title, description, pdfPath, reportText: text },
  });

  res.status(201).json({ id: project.id, title: project.title });
}

export async function listUnansweredQuestions(req: Request, res: Response) {
  const onlyPending = req.query.reviewed !== "all";
  const questions = await prisma.unansweredQuestion.findMany({
    where: onlyPending ? { reviewed: false } : undefined,
    include: {
      project: { select: { id: true, title: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(questions);
}

export async function markQuestionReviewed(req: Request, res: Response) {
  const { id } = req.params;
  const question = await prisma.unansweredQuestion.update({
    where: { id },
    data: { reviewed: true },
  });
  res.json(question);
}
