import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useParams } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { enviarPergunta, obterChat, reiniciarChat } from "@/services/api";

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const chatQueryKey = ["chat", projectId];

  const { data: chat, isLoading } = useQuery({
    queryKey: chatQueryKey,
    queryFn: () => obterChat(projectId!),
    enabled: Boolean(projectId),
  });

  const { mutate: perguntar, isPending } = useMutation({
    mutationFn: (pergunta: string) => enviarPergunta(projectId!, pergunta),
    // Otimista: mostra a pergunta do usuário na hora, sem esperar o backend.
    onMutate: async (pergunta: string) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKey });
      const previous = queryClient.getQueryData(chatQueryKey);
      queryClient.setQueryData(chatQueryKey, (old: any) => ({
        chatId: old?.chatId,
        messages: [
          ...(old?.messages ?? []),
          {
            id: `optimistic-${Date.now()}`,
            role: "USER",
            content: pergunta,
            grounded: null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return { previous };
    },
    onError: (_err, _pergunta, context) => {
      if (context?.previous) queryClient.setQueryData(chatQueryKey, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKey });
    },
  });

  const { mutate: reiniciar, isPending: isResetting } = useMutation({
    mutationFn: () => reiniciarChat(projectId!),
    onSuccess: () => {
      queryClient.setQueryData(chatQueryKey, (old: any) => ({ ...old, messages: [] }));
    },
  });

  return (
    <div className="relative h-full">
      <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-end bg-gradient-to-b from-[var(--background)] via-[var(--background)]/90 to-transparent px-3">
        <button
          type="button"
          onClick={() => reiniciar()}
          disabled={isResetting}
          title="Reiniciar chat (apaga as mensagens deste projeto)"
          className="icon-btn"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="h-full overflow-y-auto pt-16 pb-36">
        {isLoading ? (
          <p className="pt-10 text-center text-sm text-[var(--text-secondary)]">Carregando…</p>
        ) : (
          <ChatWindow messages={chat?.messages ?? []} isSending={isPending} />
        )}
      </div>

      <ChatInput onSend={(pergunta) => perguntar(pergunta)} disabled={isPending} />
    </div>
  );
}
