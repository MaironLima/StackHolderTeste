import { Briefcase } from "lucide-react";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "USER";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[75%] rounded-3xl bg-[var(--bubble-user-bg)] px-4 py-2.5 text-[var(--bubble-user-text)]">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-secondary)]">
        <Briefcase size={15} />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-primary)]">
          {message.content}
        </p>
      </div>
    </div>
  );
}
