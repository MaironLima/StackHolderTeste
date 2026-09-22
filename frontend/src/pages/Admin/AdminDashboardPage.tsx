import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  criarProjeto,
  listarPerguntasNaoRespondidas,
  listarProjetosAdmin,
  marcarPerguntaRevisada,
} from "@/services/api";

export function AdminDashboardPage() {
  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 pb-10 pt-20">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Hub de administração</h1>

      <UploadProjectSection />
      <ProjectsSection />
      <UnansweredQuestionsSection />
    </div>
  );
}

function UploadProjectSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: criarProjeto,
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.erro ?? "Falha ao enviar o PDF.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    mutate({ title, description: description || undefined, pdf: file });
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Novo projeto (PDF)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          required
          placeholder="Título do projeto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-[var(--text-secondary)]"
        />

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 self-start rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {isPending ? "Enviando…" : "Enviar PDF"}
        </button>
      </form>
    </section>
  );
}

function ProjectsSection() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: listarProjetosAdmin,
  });

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
        Projetos cadastrados
      </h2>
      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
      <ul className="flex flex-col gap-2">
        {projects?.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {project.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnansweredQuestionsSection() {
  const queryClient = useQueryClient();
  const { data: questions, isLoading } = useQuery({
    queryKey: ["unanswered-questions"],
    queryFn: listarPerguntasNaoRespondidas,
  });

  const { mutate: revisar } = useMutation({
    mutationFn: marcarPerguntaRevisada,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unanswered-questions"] }),
  });

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
        Perguntas que o stakeholder não soube responder
      </h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Ficam aqui sempre que o agente verificador não achou fundamento no relatório para a
        resposta — use para revisar e, se fizer sentido, complementar o relatório do projeto.
      </p>

      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
      {!isLoading && questions?.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">Nenhuma pendência no momento.</p>
      )}

      <ul className="flex flex-col gap-2">
        {questions?.map((q) => (
          <li
            key={q.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-primary)]">{q.question}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Projeto: {q.project.title}
                {q.user ? ` · ${q.user.email}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revisar(q.id)}
              className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Marcar revisada
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
