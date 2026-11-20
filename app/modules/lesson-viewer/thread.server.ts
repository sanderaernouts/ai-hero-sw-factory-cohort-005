import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import * as queries from "./lib/thread";

export { renderThread } from "./lib/thread";

export function createThread(database: Db) {
  return bindDb(database, {
    getCommentById: queries.getCommentById,
    getLessonThread: queries.getLessonThread,
  });
}

export const { getCommentById, getLessonThread } = createThread(db);
