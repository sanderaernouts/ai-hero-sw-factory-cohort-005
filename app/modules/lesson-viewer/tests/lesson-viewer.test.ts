import { describe, it, expect } from "vitest";
import { flattenCourseLessons } from "../course.server";
import { calculateWatchProgress } from "../progress.server";

describe("flattenCourseLessons", () => {
  it("lists every lesson in curriculum order, tagged with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        {
          id: 1,
          title: "Basics",
          lessons: [
            { id: 10, title: "Hello", moduleId: 1 },
            { id: 11, title: "Types", moduleId: 1 },
          ],
        },
        { id: 2, title: "Empty", lessons: [] },
        {
          id: 3,
          title: "Generics",
          lessons: [{ id: 30, title: "T", moduleId: 3 }],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 10, title: "Hello", moduleId: 1, moduleTitle: "Basics" },
      { id: 11, title: "Types", moduleId: 1, moduleTitle: "Basics" },
      { id: 30, title: "T", moduleId: 3, moduleTitle: "Generics" },
    ]);
  });
});

describe("calculateWatchProgress", () => {
  it("is zero for a video with no known duration", () => {
    expect(calculateWatchProgress(1, 1, 0)).toBe(0);
    expect(calculateWatchProgress(1, 1, -5)).toBe(0);
  });
});
