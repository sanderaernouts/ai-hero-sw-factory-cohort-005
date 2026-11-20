import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

const saved = { body: "Result types", updatedAt: "2026-11-01T10:00:00.000Z" };

describe("describeNoteDraft", () => {
  it("shows an empty, unsaveable editor when there is no note yet", () => {
    expect(describeNoteDraft({ draft: "", saved: null })).toEqual({
      length: 0,
      maxLength: MAX_NOTE_LENGTH,
      overLimit: false,
      canSave: false,
      status: { kind: "empty" },
    });
  });

  it("shows when the saved note was last edited while the draft matches it", () => {
    const result = describeNoteDraft({ draft: saved.body, saved });
    expect(result.status).toEqual({
      kind: "saved",
      updatedAt: saved.updatedAt,
    });
    expect(result.canSave).toBe(false);
    expect(result.length).toBe(saved.body.length);
  });

  it("marks a changed draft as unsaved and lets it be saved", () => {
    const result = describeNoteDraft({ draft: "Result types!", saved });
    expect(result.status).toEqual({ kind: "unsaved" });
    expect(result.canSave).toBe(true);
  });

  it("marks a first draft as unsaved", () => {
    const result = describeNoteDraft({ draft: "first", saved: null });
    expect(result.status).toEqual({ kind: "unsaved" });
    expect(result.canSave).toBe(true);
  });

  it("treats surrounding whitespace as no change, since the server trims it", () => {
    const result = describeNoteDraft({ draft: `  ${saved.body}\n`, saved });
    expect(result.canSave).toBe(false);
    expect(result.status.kind).toBe("saved");
  });

  it("does not count surrounding whitespace against the limit", () => {
    const result = describeNoteDraft({
      draft: ` ${"a".repeat(MAX_NOTE_LENGTH)} `,
      saved: null,
    });
    expect(result.overLimit).toBe(false);
  });

  it("does not offer to save a blank draft", () => {
    const result = describeNoteDraft({ draft: "   ", saved });
    expect(result.canSave).toBe(false);
    expect(result.status).toEqual({
      kind: "saved",
      updatedAt: saved.updatedAt,
    });
  });

  it("allows a draft of exactly the limit", () => {
    const result = describeNoteDraft({
      draft: "a".repeat(MAX_NOTE_LENGTH),
      saved: null,
    });
    expect(result.overLimit).toBe(false);
    expect(result.canSave).toBe(true);
  });

  it("refuses a draft over the limit", () => {
    const result = describeNoteDraft({
      draft: "a".repeat(MAX_NOTE_LENGTH + 1),
      saved: null,
    });
    expect(result.overLimit).toBe(true);
    expect(result.canSave).toBe(false);
  });

  it("shows the server's error ahead of anything else", () => {
    const result = describeNoteDraft({
      draft: "changed",
      saved,
      error: "Your note is too long.",
    });
    expect(result.status).toEqual({
      kind: "error",
      message: "Your note is too long.",
    });
  });
});
