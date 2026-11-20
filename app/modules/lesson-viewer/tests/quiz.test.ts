import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { getQuizWithQuestions } from "../quiz.server";

// lesson-viewer reads the app's shared db, so swap in a fresh test db per test.
const holder = vi.hoisted(() => ({ db: undefined as unknown as TestDb }));
vi.mock("~/db", () => ({
  get db() {
    return holder.db;
  },
}));

// ─── Fixtures ───
// Nothing in lesson-viewer writes quizzes, so rows go in directly.

let quizId: number;

beforeEach(() => {
  holder.db = createTestDb();
  const { course } = seedBaseData(holder.db);
  const mod = holder.db
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  const lesson = holder.db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();
  quizId = holder.db
    .insert(schema.quizzes)
    .values({ lessonId: lesson.id, title: "Quiz", passingScore: 0.7 })
    .returning()
    .get().id;
});

function addQuestion(
  questionText: string,
  position: number,
  options: string[]
) {
  const question = holder.db
    .insert(schema.quizQuestions)
    .values({
      quizId,
      questionText,
      questionType: QuestionType.MultipleChoice,
      position,
    })
    .returning()
    .get();
  for (const optionText of options) {
    holder.db
      .insert(schema.quizOptions)
      .values({ questionId: question.id, optionText, isCorrect: false })
      .run();
  }
}

function optionTexts(id: number) {
  return getQuizWithQuestions(id)?.questions.map((question) =>
    question.options.map((option) => option.optionText)
  );
}

describe("getQuizWithQuestions", () => {
  it("gives each question its own options, in question order", () => {
    addQuestion("Second", 2, ["c", "d", "e"]);
    addQuestion("First", 1, ["a", "b"]);

    expect(optionTexts(quizId)).toEqual([
      ["a", "b"],
      ["c", "d", "e"],
    ]);
  });

  it("returns a quiz with no questions", () => {
    expect(optionTexts(quizId)).toEqual([]);
  });

  it("returns null for an unknown quiz", () => {
    expect(getQuizWithQuestions(quizId + 1)).toBeNull();
  });
});
