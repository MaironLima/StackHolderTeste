import { Request, Response } from "express";
import { z } from "zod";
import { MessageRole } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { askAdkAgent, AdkHistoryTurn } from "../services/adkClient.service";

const HISTORY_LIMIT = 20; // últimas N mensagens mandadas como histórico pro agente

async function getOrCreateChat(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Projeto não encontrado");

  const chat = await prisma.chat.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {},
    create: { userId, projectId },
  });

  return { chat, project };
}

export async function getChat(req: Request, res: Response) {
  const { projectId } = req.params;
  const { chat } = await getOrCreateChat(req.user!.id, projectId);

  const messages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ chatId: chat.id, messages });
}

const messageSchema = z.object({ pergunta: z.string().trim().min(1) });

export async function sendMessage(req: Request, res: Response) {
  const { projectId } = req.params;
  const { pergunta } = messageSchema.parse(req.body);
  const { chat, project } = await getOrCreateChat(req.user!.id, projectId);

  await prisma.message.create({
    data: { chatId: chat.id, role: MessageRole.USER, content: pergunta },
  });

  const previousMessages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT + 1, // +1 porque a pergunta que acabamos de salvar já está aí
    skip: 1,
  });

  const history: AdkHistoryTurn[] = previousMessages
    .reverse()
    .map((m: { role: MessageRole; content: string }) => ({
      role: m.role === MessageRole.USER ? ("user" as const) : ("stakeholder" as const),
      content: m.content,
    }));

  const { answer, grounded } = await askAdkAgent({
    question: pergunta,
    reportText: project.reportText,
    history,
  });

  const stakeholderMessage = await prisma.message.create({
    data: { chatId: chat.id, role: MessageRole.STAKEHOLDER, content: answer, grounded },
  });

  if (!grounded) {
    await prisma.unansweredQuestion.create({
      data: { projectId, userId: req.user!.id, question: pergunta },
    });
  }

  res.json({ resposta: stakeholderMessage.content, grounded, dataHora: stakeholderMessage.createdAt });
}

export async function resetChat(req: Request, res: Response) {
  const { projectId } = req.params;
  const { chat } = await getOrCreateChat(req.user!.id, projectId);

  // Apaga as mensagens do chat atual — o registro do Chat continua o
  // mesmo (é o "slot" único do usuário para esse projeto), mas some toda
  // a memória anterior, exatamente como pedido.
  await prisma.message.deleteMany({ where: { chatId: chat.id } });

  res.json({ ok: true });
}
