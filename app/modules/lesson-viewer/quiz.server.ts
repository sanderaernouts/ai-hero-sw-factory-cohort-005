import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import * as queries from "./lib/quiz";

export function createQuiz(database: Db) {
  return bindDb(database, {
    getQuizById: queries.getQuizById,
    getQuizByLessonId: queries.getQuizByLessonId,
    getQuizWithQuestions: queries.getQuizWithQuestions,
    getBestAttempt: queries.getBestAttempt,
    computeResult: queries.computeResult,
  });
}

export const {
  getQuizById,
  getQuizByLessonId,
  getQuizWithQuestions,
  getBestAttempt,
  computeResult,
} = createQuiz(db);
