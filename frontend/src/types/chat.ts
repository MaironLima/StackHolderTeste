export type MessageRole = "USER" | "STAKEHOLDER";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  grounded: boolean | null;
  createdAt: string;
}

export interface ChatResponse {
  chatId: string;
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  resposta: string;
  grounded: boolean;
  dataHora: string;
}
