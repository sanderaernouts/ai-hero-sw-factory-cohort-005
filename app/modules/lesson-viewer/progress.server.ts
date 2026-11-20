import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import * as queries from "./lib/progress";

export function createProgress(database: Db) {
  return bindDb(database, {
    getLessonProgress: queries.getLessonProgress,
    getLessonProgressForCourse: queries.getLessonProgressForCourse,
    markLessonComplete: queries.markLessonComplete,
    markLessonInProgress: queries.markLessonInProgress,
    getLastWatchPosition: queries.getLastWatchPosition,
    calculateWatchProgress: queries.calculateWatchProgress,
  });
}

export const {
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
  getLastWatchPosition,
  calculateWatchProgress,
} = createProgress(db);
