// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createRoutesStub } from "react-router";
import { CourseStatus, UserRole } from "~/db/schema";
import { COUNTRIES, getCountryTierInfo } from "~/lib/ppp";
import { markdown } from "~/lib/text";
import Home from "./home";

type HomeProps = Parameters<typeof Home>[0];
type LoaderData = HomeProps["loaderData"];
type FeaturedCourse = LoaderData["featuredCourses"][number];

function aCourse(overrides: Partial<FeaturedCourse> = {}): FeaturedCourse {
  return {
    id: 1,
    title: "Building REST APIs with Node.js",
    slug: "building-rest-apis",
    description: "Learn to build production-ready REST APIs.",
    salesCopy: markdown(""),
    instructorId: 2,
    categoryId: 1,
    status: CourseStatus.Published,
    coverImageUrl: null,
    price: 0,
    pppEnabled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    instructorName: "Marcus Johnson",
    instructorAvatarUrl: null,
    categoryName: "Backend",
    lessonCount: 20,
    ...overrides,
  };
}

function loaderData(overrides: Partial<LoaderData> = {}): LoaderData {
  return {
    featuredCourses: [aCourse()],
    totalCourses: 4,
    totalCategories: 5,
    users: [],
    currentUser: null,
    devCountry: null,
    countryTierInfo: getCountryTierInfo(null),
    countries: COUNTRIES,
    ...overrides,
  };
}

function renderHome(data: LoaderData) {
  const Stub = createRoutesStub([
    {
      path: "/",
      // The stub hands the route only router props; the test supplies the loader data.
      Component: () => <Home {...({ loaderData: data } as HomeProps)} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

function pageBandHolding(html: string, text: string) {
  const match = html
    .split(/(?=<section|<footer)/)
    .find((block) => block.includes(text));
  if (!match) throw new Error(`No section holds "${text}"`);
  return match;
}

function classesOf(html: string) {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
    m[1].split(/\s+/)
  );
}

function openingTagBefore(html: string, text: string) {
  const at = html.indexOf(text);
  if (at === -1) throw new Error(`The page does not hold "${text}"`);
  const before = html.slice(0, at);
  return before.slice(before.lastIndexOf("<"));
}

function linkTo(html: string, href: string) {
  const match = html.match(
    new RegExp(`<a[^>]*href="${href}"[^>]*>(?:(?!</a>).)*</a>`, "s")
  );
  return match?.[0] ?? null;
}

describe("landing page", () => {
  it("left-aligns the hero, the stats strip and the footer", () => {
    const page = renderHome(loaderData());

    for (const text of ["Learn to code", "Available Courses", "<footer"]) {
      expect(classesOf(pageBandHolding(page, text))).not.toContain(
        "text-center"
      );
    }
  });

  it("does not centre the hero paragraph or its buttons", () => {
    const hero = pageBandHolding(renderHome(loaderData()), "Learn to code");
    const paragraph = openingTagBefore(hero, "Structured courses");
    const buttonRow = openingTagBefore(hero, '<a data-slot="button"');

    expect(paragraph).toMatch(/^<p /);
    expect(classesOf(paragraph)).not.toContain("mx-auto");
    expect(buttonRow).toMatch(/^<div class="[^"]*\bflex\b/);
    expect(classesOf(buttonRow)).not.toContain("justify-center");
  });

  it("shows the newest course beside the hero copy", () => {
    const hero = pageBandHolding(
      renderHome(
        loaderData({
          featuredCourses: [
            aCourse({ id: 7, title: "Newest One", slug: "newest-one" }),
            aCourse({ id: 3, title: "Older One", slug: "older-one" }),
          ],
        })
      ),
      "Learn to code"
    );

    const spotlight = linkTo(hero, "/courses/newest-one");
    expect(spotlight).toContain("Newest course");
    expect(spotlight).toContain("Newest One");
    expect(spotlight).toContain("20<!-- --> lessons");
    expect(hero).not.toContain("Older One");
  });

  it("leaves the spotlight out when no course is published", () => {
    const hero = pageBandHolding(
      renderHome(loaderData({ featuredCourses: [] })),
      "Learn to code"
    );

    expect(hero).not.toContain("Newest course");
    expect(hero).not.toMatch(/href="\/courses\//);
  });

  it("offers sign-up to a visitor and the dashboard to a signed-in user", () => {
    const visitorHero = pageBandHolding(
      renderHome(loaderData()),
      "Learn to code"
    );
    const memberHero = pageBandHolding(
      renderHome(
        loaderData({
          currentUser: { id: 5, name: "Emma Wilson", role: UserRole.Student },
        })
      ),
      "Learn to code"
    );

    expect(linkTo(visitorHero, "/signup")).toContain("Sign Up");
    expect(linkTo(visitorHero, "/dashboard")).toBeNull();
    expect(linkTo(memberHero, "/dashboard")).toContain("Go to Dashboard");
    expect(linkTo(memberHero, "/signup")).toBeNull();
  });
});
