import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

function tokenIn(selector: string, token: string) {
  const block = css.match(
    new RegExp(`${selector.replace(".", "\\.")} \\{([^}]*)\\}`)
  );
  const value = block?.[1].match(new RegExp(`--${token}: oklch\\(([^)]*)\\);`));
  if (!value) throw new Error(`--${token} not found in ${selector}`);
  const [lightness, chroma, hue] = value[1].split(" ").map(Number);
  return { lightness, chroma, hue };
}

function isPurple({ chroma, hue }: { chroma: number; hue: number }) {
  return chroma > 0.1 && hue >= 280 && hue <= 320;
}

describe("theme", () => {
  for (const selector of [":root", ".dark"]) {
    for (const token of ["primary", "sidebar-primary"]) {
      it(`uses purple for --${token} in ${selector}`, () => {
        expect(isPurple(tokenIn(selector, token))).toBe(true);
      });
    }
  }

  it("keeps primary text readable on the light theme's purple", () => {
    expect(tokenIn(":root", "primary").lightness).toBeLessThan(0.6);
    expect(tokenIn(":root", "primary-foreground").lightness).toBeGreaterThan(
      0.9
    );
  });

  it("keeps primary text readable on the dark theme's purple", () => {
    expect(tokenIn(".dark", "primary").lightness).toBeGreaterThan(0.65);
    expect(tokenIn(".dark", "primary-foreground").lightness).toBeLessThan(0.3);
  });
});
