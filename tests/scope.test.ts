import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const CRISP_SCOPE = ".markdown-reading-view.crisp-craft-enabled";

interface CssRuleBlock {
  selector: string;
  declarations: string;
  atRules: string[];
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  let quote = "";

  for (let index = 0; index < selectorList.length; index += 1) {
    const character = selectorList[index];

    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

function readRuleBlocks(css: string): CssRuleBlock[] {
  const source = stripCssComments(css);
  const blocks: CssRuleBlock[] = [];
  const stack: Array<{
    prelude: string;
    declarationStart: number;
    atRule: boolean;
  }> = [];
  let segmentStart = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      const prelude = source.slice(segmentStart, index).trim();
      stack.push({
        prelude,
        declarationStart: index + 1,
        atRule: prelude.startsWith("@"),
      });
      segmentStart = index + 1;
    } else if (character === "}") {
      const block = stack.pop();
      const insideKeyframes = stack.some((entry) =>
        /^@(?:-\w+-)?keyframes\b/i.test(entry.prelude),
      );

      if (block && !block.atRule && !insideKeyframes) {
        blocks.push({
          selector: block.prelude,
          declarations: source.slice(block.declarationStart, index),
          atRules: stack
            .filter((entry) => entry.atRule)
            .map((entry) => entry.prelude),
        });
      }

      segmentStart = index + 1;
    }
  }

  return blocks;
}

function unscopedSelectors(css: string): string[] {
  return readRuleBlocks(css).flatMap((block) =>
    splitSelectorList(block.selector).filter(
      (selector) => !selector.includes(CRISP_SCOPE),
    ),
  );
}

describe("Reading View CSS scope", () => {
  const css = fs.readFileSync(
    path.resolve(testDirectory, "../styles.css"),
    "utf8",
  );
  const blocks = readRuleBlocks(css);
  const selectors = blocks.flatMap((block) =>
    splitSelectorList(block.selector),
  );

  it("does not target editor/source selectors", () => {
    expect(css).not.toContain(".cm-");
    expect(css).not.toContain(".markdown-source-view");
    expect(css).not.toContain(".is-live-preview");
  });

  it("rejects unscoped component rules, including nested at-rules", () => {
    const violations = unscopedSelectors(`
      h2 { font-weight: 600; }
      ${CRISP_SCOPE} h2 { font-weight: 600; }
      @media (hover: hover) {
        table:hover { background-color: transparent; }
        ${CRISP_SCOPE} table:hover { background-color: transparent; }
      }
    `);

    expect(violations).toEqual(["h2", "table:hover"]);
  });

  it("scopes every non-comment selector block", () => {
    expect(unscopedSelectors(css)).toEqual([]);
  });

  it("provides scoped selectors for every V1 component preset", () => {
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-heading-style="editorial"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-heading-style="clean"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-heading-style="marker"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-quote-style="glass-edge"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-quote-style="edge"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-quote-style="minimal"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-image-frame="none"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-image-frame="subtle"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-image-frame="glass"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) =>
        selector.includes('[data-cc-image-rounded="false"]'),
      ),
    ).toBe(true);
    expect(
      selectors.some((selector) => selector.includes('[data-cc-table="true"]')),
    ).toBe(true);
  });

  it("does not decorate H5/H6 or replace heading fonts", () => {
    const headingSelectors = selectors.filter((selector) =>
      selector.includes("[data-cc-heading-style="),
    );

    expect(headingSelectors.length).toBeGreaterThan(0);
    for (const selector of headingSelectors) {
      expect(selector).not.toMatch(/\bh[56]\b/);
    }

    const headingBlocks = blocks.filter((block) =>
      block.selector.includes("[data-cc-heading-style="),
    );
    for (const block of headingBlocks) {
      expect(block.declarations).not.toContain("font-family");
    }
  });

  it("excludes divider callouts from generic quote styling", () => {
    const quoteCalloutSelectors = selectors.filter(
      (selector) =>
        selector.includes("[data-cc-quote-style=") &&
        selector.includes(".callout"),
    );

    expect(quoteCalloutSelectors.length).toBeGreaterThan(0);
    for (const selector of quoteCalloutSelectors) {
      expect(selector).toContain(
        '.callout:not([data-callout="divider"]):not(.cc-divider-callout)',
      );
    }
  });

  it("keeps pointer-only table hover styles inside a hover media query", () => {
    const hoverBlocks = blocks.filter(
      (block) =>
        block.selector.includes('[data-cc-table="true"]') &&
        block.selector.includes(":hover"),
    );

    expect(hoverBlocks.length).toBeGreaterThan(0);
    for (const block of hoverBlocks) {
      expect(
        block.atRules.some((atRule) => /^@media\s*\(hover:\s*hover\)/.test(atRule)),
      ).toBe(true);
    }
  });

  it("limits the translucent compositor guard to active Craft glass surfaces", () => {
    const guardBlocks = blocks.filter(
      (block) =>
        block.declarations.includes("backdrop-filter: none !important") &&
        block.declarations.includes("-webkit-backdrop-filter: none !important"),
    );
    const guardSelectors = guardBlocks.flatMap((block) =>
      splitSelectorList(block.selector),
    );
    const isGuarded = (element: Element): boolean =>
      guardSelectors.some((selector) => element.matches(selector));

    document.body.classList.add("is-translucent");
    const plainRoot = document.createElement("div");
    plainRoot.className = "markdown-reading-view crisp-craft-enabled";
    plainRoot.innerHTML = `
      <section class="markdown-preview-section">
        <blockquote></blockquote>
        <div class="callout"></div>
        <span class="media-embed"></span>
      </section>
    `;
    document.body.append(plainRoot);

    const plainQuote = plainRoot.querySelector("blockquote")!;
    const plainCallout = plainRoot.querySelector(".callout")!;
    const plainMedia = plainRoot.querySelector(".media-embed")!;
    expect(isGuarded(plainQuote)).toBe(false);
    expect(isGuarded(plainCallout)).toBe(false);
    expect(isGuarded(plainMedia)).toBe(false);

    const glassRoot = document.createElement("div");
    glassRoot.className = "markdown-reading-view crisp-craft-enabled";
    glassRoot.dataset.ccQuoteStyle = "glass-edge";
    glassRoot.innerHTML = `
      <section class="markdown-preview-section">
        <blockquote></blockquote>
        <div class="callout" data-callout="note"></div>
      </section>
    `;
    document.body.append(glassRoot);
    expect(isGuarded(glassRoot.querySelector("blockquote")!)).toBe(true);
    expect(isGuarded(glassRoot.querySelector(".callout")!)).toBe(true);

    const dividerRoot = document.createElement("div");
    dividerRoot.className = "markdown-reading-view crisp-craft-enabled";
    dividerRoot.dataset.ccDividerDefault = "glass";
    dividerRoot.innerHTML = `
      <section class="markdown-preview-section">
        <hr class="cc-divider">
        <div class="callout cc-divider-callout cc-divider-glass"></div>
      </section>
    `;
    document.body.append(dividerRoot);
    expect(isGuarded(dividerRoot.querySelector("hr")!)).toBe(true);
    expect(isGuarded(dividerRoot.querySelector(".cc-divider-callout")!)).toBe(
      true,
    );

    const attachmentRoot = document.createElement("div");
    attachmentRoot.className = "markdown-reading-view crisp-craft-enabled";
    attachmentRoot.dataset.ccAttachmentStyle = "soft";
    attachmentRoot.innerHTML = '<a class="cc-attachment" data-cc-ext="pdf"></a>';
    document.body.append(attachmentRoot);
    expect(isGuarded(attachmentRoot.querySelector(".cc-attachment")!)).toBe(
      true,
    );

    const imageRoot = document.createElement("div");
    imageRoot.className = "markdown-reading-view crisp-craft-enabled";
    imageRoot.dataset.ccImageFrame = "glass";
    imageRoot.innerHTML = `
      <section class="markdown-preview-section">
        <span class="image-embed"><img></span>
      </section>
    `;
    document.body.append(imageRoot);
    expect(isGuarded(imageRoot.querySelector(".image-embed")!)).toBe(true);

    document.body.classList.remove("is-translucent");
    expect(isGuarded(glassRoot.querySelector("blockquote")!)).toBe(false);

    plainRoot.remove();
    glassRoot.remove();
    dividerRoot.remove();
    attachmentRoot.remove();
    imageRoot.remove();
  });
});
