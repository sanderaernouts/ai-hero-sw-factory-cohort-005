import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import * as queries from "./lib/course";

export { flattenCourseLessons } from "./lib/course";

export function createCourse(database: Db) {
  return bindDb(database, {
    getCourseWithDetails: queries.getCourseWithDetails,
    getLessonById: queries.getLessonById,
    getModuleById: queries.getModuleById,
    getUserById: queries.getUserById,
  });
}

export const {
  getCourseWithDetails,
  getLessonById,
  getModuleById,
  getUserById,
} = createCourse(db);
