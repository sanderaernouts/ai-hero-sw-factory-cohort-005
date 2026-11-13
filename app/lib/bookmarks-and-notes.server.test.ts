import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  isBookmarked,
  listBookmarksForStudent,
  toggleBookmark,
} from "./bookmarks.server";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";
import { MAX_NOTE_LENGTH, NOTE_TOO_LONG } from "./notes";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 7, 9, 30, 0);
const LATEST = new Date(2026, 9, 8, 18, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];
let otherStudent: typeof schema.users.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );

  otherStudent = db
    .insert(schema.users)
    .values({ name: "Other", email: "other@example.com", role: UserRole.Student })
    .returning()
    .get();
});

describe("bookmarking a Lesson", () => {
  it("bookmarks a Lesson with no Bookmark, and un-bookmarks it on the next toggle", () => {
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], LATER)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });

  it("never leaves a Student with two Bookmarks on the same Lesson", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);

    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: base.user.id, lessonId: lessonIds[0] })
        .run()
    ).toThrow(/UNIQUE/);
    expect(listBookmarksForStudent(db, base.user.id)).toHaveLength(1);
  });
});

describe("saving a Note", () => {
  it("creates a Note on a Lesson with none, with the body trimmed", () => {
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();

    expect(saveNote(db, base.user.id, lessonIds[0], "  Revisit closures.  ", NOW)).toMatchObject({
      ok: true,
    });

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "Revisit closures.",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First thoughts", NOW);
    const resaved = saveNote(db, base.user.id, lessonIds[0], "Second thoughts", LATER);

    expect(resaved).toMatchObject({
      ok: true,
      note: {
        body: "Second thoughts",
        createdAt: NOW.toISOString(),
        updatedAt: LATER.toISOString(),
      },
    });
    expect(listNotesForStudent(db, base.user.id)).toHaveLength(1);
  });

  it("never leaves a Student with two Notes on the same Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "Mine", NOW);

    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Again" })
        .run()
    ).toThrow(/UNIQUE/);
  });

  it("accepts a Note of exactly 2,000 characters", () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);

    expect(saveNote(db, base.user.id, lessonIds[0], body, NOW)).toMatchObject({ ok: true });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe(body);
  });

  it("refuses a Note over 2,000 characters and stores nothing", () => {
    expect(
      saveNote(db, base.user.id, lessonIds[0], "a".repeat(MAX_NOTE_LENGTH + 1), NOW)
    ).toEqual({ ok: false, error: NOTE_TOO_LONG });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("keeps Markdown characters exactly as typed", () => {
    saveNote(db, base.user.id, lessonIds[0], "# not a heading\n*not bold*", NOW);

    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("# not a heading\n*not bold*");
  });
});

describe("the Saved lists", () => {
  it("lists only the Student's own Bookmarks, newest first, with Lesson and Course", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[2], LATEST);
    toggleBookmark(db, base.user.id, lessonIds[1], LATER);
    toggleBookmark(db, otherStudent.id, lessonIds[0], LATEST);

    expect(listBookmarksForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({ lessonId: lessonIds[2], lessonTitle: "Lesson 3", courseTitle: "Test Course", courseSlug: "test-course" }),
      expect.objectContaining({ lessonId: lessonIds[1], lessonTitle: "Lesson 2", courseTitle: "Test Course" }),
      expect.objectContaining({ lessonId: lessonIds[0], lessonTitle: "Lesson 1", courseTitle: "Test Course" }),
    ]);
  });

  it("lists only the Student's own Notes, last edited first, with Lesson and Course", () => {
    saveNote(db, base.user.id, lessonIds[0], "one", NOW);
    saveNote(db, base.user.id, lessonIds[1], "two", LATER);
    saveNote(db, base.user.id, lessonIds[0], "one, edited", LATEST);
    saveNote(db, otherStudent.id, lessonIds[2], "not yours", LATEST);

    expect(listNotesForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({ body: "one, edited", lessonTitle: "Lesson 1", courseTitle: "Test Course", courseSlug: "test-course" }),
      expect.objectContaining({ body: "two", lessonTitle: "Lesson 2", courseTitle: "Test Course" }),
    ]);
  });
});

describe("approving a Refund", () => {
  it("leaves the Student's Bookmarks and Notes in place", async () => {
    const notifications = fakeNotifications();
    const platformAdmin = db
      .insert(schema.users)
      .values({ name: "Pat Admin", email: "pat@example.com", role: UserRole.Admin })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: new Date(2026, 9, 4).toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    saveNote(db, base.user.id, lessonIds[0], "Keep me", NOW);

    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "It was not what I expected.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );

    expect(approved.ok).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("Keep me");
  });
});
