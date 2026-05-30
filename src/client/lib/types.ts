import type { ChatAnswer } from "../../shared/types";

/** A single question + its answer, persisted locally for conversation memory. */
export type ConversationEntry = {
  id: string;
  question: string;
  answer: ChatAnswer;
  createdAt: string;
};

export type ApiError = { error: string };
