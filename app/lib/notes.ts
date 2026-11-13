import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

export const NOTE_TOO_LONG = `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters.`;
export const NOTE_EMPTY = "Write something before saving your note.";

// The one rule for a Note body: plain text, trimmed, not empty, and capped.
// Over-long bodies are refused, never truncated.
export const noteBodySchema = z
  .string()
  .trim()
  .min(1, NOTE_EMPTY)
  .max(MAX_NOTE_LENGTH, NOTE_TOO_LONG);
