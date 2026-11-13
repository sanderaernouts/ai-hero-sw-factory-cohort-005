import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { courses, lessons, modules } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * The columns every Saved row needs to link back to its Lesson and name its
 * Course. Join `lessons`, `modules` and `courses` to select them.
 */
export const savedLessonColumns = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};
