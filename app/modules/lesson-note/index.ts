import { describe } from "./lib/draft";

export type { NoteDraft, NoteStatus } from "./lib/draft";

/**
 * What the notes editor shows for the text a Student has typed: the
 * character count, whether Save is allowed, and the status beside it.
 */
export const describeNoteDraft = describe;
