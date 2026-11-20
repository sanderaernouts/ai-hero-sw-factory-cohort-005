import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteStatus =
  | { kind: "error"; message: string }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "empty" };

export type NoteDraft = {
  length: number;
  maxLength: number;
  overLimit: boolean;
  canSave: boolean;
  status: NoteStatus;
};

export function describe({
  draft,
  saved,
  error,
}: {
  draft: string;
  saved: { body: string; updatedAt: string } | null;
  error?: string;
}): NoteDraft {
  // The server trims before it saves, so compare and count what it will keep.
  const kept = draft.trim();
  const overLimit = kept.length > MAX_NOTE_LENGTH;
  const blank = kept.length === 0;
  const changed = saved === null || kept !== saved.body;

  let status: NoteStatus;
  if (error) status = { kind: "error", message: error };
  else if (changed && !blank) status = { kind: "unsaved" };
  else if (saved) status = { kind: "saved", updatedAt: saved.updatedAt };
  else status = { kind: "empty" };

  return {
    length: draft.length,
    maxLength: MAX_NOTE_LENGTH,
    overLimit,
    canSave: changed && !blank && !overLimit,
    status,
  };
}
