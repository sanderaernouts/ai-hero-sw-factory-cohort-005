import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");

function oklchOf(selector: string, token: string) {
  const block = css.match(
    new RegExp(`${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`)
  );
  if (!block) throw new Error(`${selector} block not found in app.css`);
  const value = block[1].match(new RegExp(`--${token}: oklch\\(([^)]*)\\);`));
  if (!value) throw new Error(`--${token} not found in ${selector}`);
  const [lightness, chroma, hue] = value[1].split(" ").map(Number);
  return { lightness, chroma, hue };
}

function isPurple({ chroma, hue }: { chroma: number; hue: number }) {
  return chroma > 0.1 && hue >= 280 && hue <= 320;
}

// Lightness stands in for contrast: a dark purple needs near-white text and a
// light purple needs near-black text, or the pair falls below WCAG AA.
const readableLightness = [
  { selector: ":root", purple: [0, 0.6], text: [0.9, 1] },
  { selector: ".dark", purple: [0.65, 1], text: [0, 0.3] },
];

function isWithin(value: number, [min, max]: number[]) {
  return value >= min && value <= max;
}

describe("theme", () => {
  for (const selector of [":root", ".dark"]) {
    for (const token of ["primary", "sidebar-primary"]) {
      it(`uses purple for --${token} in ${selector}`, () => {
        expect(isPurple(oklchOf(selector, token))).toBe(true);
      });
    }
  }

  for (const { selector, purple, text } of readableLightness) {
    for (const token of ["primary", "sidebar-primary"]) {
      it(`keeps --${token}-foreground readable on --${token} in ${selector}`, () => {
        const pair = {
          purple: oklchOf(selector, token).lightness,
          text: oklchOf(selector, `${token}-foreground`).lightness,
        };
        expect({
          purple: isWithin(pair.purple, purple),
          text: isWithin(pair.text, text),
        }).toEqual({ purple: true, text: true });
      });
    }
  }
});
