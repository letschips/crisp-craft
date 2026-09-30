import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { MarkdownView } from "obsidian";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type CrispCraftSettings,
  type DividerStyle,
} from "../src/settings";
import { DIVIDER_STYLES, decorateDividers } from "../src/divider";
import { processRenderedSection } from "../src/post-process";
import CrispCraftPlugin from "../src/main";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function createFixture(html: string) {
  const dom = new JSDOM(`
    <div class="markdown-reading-view">
      <div class="markdown-preview-section">${html}</div>
    </div>
  `);
  const root = dom.window.document.querySelector(
    ".markdown-reading-view",
  ) as HTMLElement;
  const section = dom.window.document.querySelector(
    ".markdown-preview-section",
  ) as HTMLElement;

  return { dom, root, section };
}

function getCallout(
  section: HTMLElement,
  metadata: string,
  content = "",
): HTMLElement {
  return section.querySelector(
    `[data-callout="divider"][data-callout-metadata="${metadata}"]`,
  ) as HTMLElement;
}

describe("divider decoration", () => {
  it("adds the separator class without replacing a native hr", () => {
    const { section } = createFixture("<hr>");
    const hr = section.querySelector("hr") as HTMLHRElement;

    decorateDividers(section, DEFAULT_SETTINGS);
    decorateDividers(section, DEFAULT_SETTINGS);

    expect(section.querySelector("hr")).toBe(hr);
    expect(hr.tagName).toBe("HR");
    expect(hr.classList.contains("cc-divider")).toBe(true);
    expect(hr.classList).toHaveLength(1);
  });

  it("classifies a content-free wave divider callout", () => {
    const { section } = createFixture(`
      <div class="callout" data-callout="divider" data-callout-metadata="wave">
        <div class="callout-title">Divider</div>
      </div>
    `);
    const callout = getCallout(section, "wave");

    decorateDividers(section, DEFAULT_SETTINGS);
    decorateDividers(section, DEFAULT_SETTINGS);

    expect(callout.classList.contains("cc-divider-callout")).toBe(true);
    expect(callout.classList.contains("cc-divider-wave")).toBe(true);
    expect(callout.getAttribute("role")).toBe("separator");
    expect(callout.getAttribute("aria-orientation")).toBe("horizontal");
    expect(callout.querySelector(".callout-title")?.textContent).toBe("Divider");
    expect(
      callout.classList.toString().match(/cc-divider-wave/g),
    ).toHaveLength(1);
  });

  it("uses the configured default for invalid metadata", () => {
    const { section } = createFixture(`
      <div class="callout" data-callout="divider" data-callout-metadata="unknown">
        <div class="callout-title">Divider</div>
      </div>
    `);
    const callout = getCallout(section, "unknown");
    const settings = normalizeSettings({
      divider: { defaultStyle: "dots" },
    });

    decorateDividers(section, settings);

    expect(callout.classList.contains("cc-divider-callout")).toBe(true);
    expect(callout.classList.contains("cc-divider-dots")).toBe(true);
    expect(callout.classList.contains("cc-divider-wave")).toBe(false);
  });

  it.each([...DIVIDER_STYLES])(
    "accepts the exact divider style %s",
    (style) => {
      const { section } = createFixture(`
        <div class="callout" data-callout="divider" data-callout-metadata="${style}">
          <div class="callout-title">Divider</div>
        </div>
      `);
      const callout = getCallout(section, style);

      decorateDividers(section, DEFAULT_SETTINGS);

      expect(callout.classList.contains("cc-divider-callout")).toBe(true);
      expect(callout.classList.contains(`cc-divider-${style}`)).toBe(true);
      expect(callout.getAttribute("role")).toBe("separator");
    },
  );

  it("preserves a callout with an explicit callout-content node", () => {
    const { section } = createFixture(`
      <div class="callout" data-callout="divider" data-callout-metadata="wave">
        <div class="callout-title">Divider</div>
        <div class="callout-content"></div>
      </div>
    `);
    const callout = getCallout(section, "wave");

    decorateDividers(section, DEFAULT_SETTINGS);

    expect(callout.className).toBe("callout");
    expect(callout.hasAttribute("role")).toBe(false);
    expect(callout.hasAttribute("aria-orientation")).toBe(false);
  });

  it("preserves non-whitespace callout content outside the title", () => {
    const { section } = createFixture(`
      <div class="callout" data-callout="divider" data-callout-metadata="brush">
        <div class="callout-title">Divider</div>
        <p>Keep this explanation.</p>
      </div>
    `);
    const callout = getCallout(section, "brush");

    decorateDividers(section, DEFAULT_SETTINGS);

    expect(callout.className).toBe("callout");
    expect(callout.querySelector("p")?.textContent).toBe(
      "Keep this explanation.",
    );
    expect(callout.hasAttribute("role")).toBe(false);
  });

  it("clears stale decoration when meaningful content is present", () => {
    const { section } = createFixture(`
      <div class="callout cc-divider-callout cc-divider-wave" role="separator"
        aria-orientation="horizontal" data-callout="divider"
        data-callout-metadata="wave">
        <div class="callout-title">Divider</div>
        <div class="callout-content">Meaningful text</div>
      </div>
    `);
    const callout = getCallout(section, "wave");

    decorateDividers(section, DEFAULT_SETTINGS);

    expect(callout.classList.contains("cc-divider-callout")).toBe(false);
    expect(callout.classList.contains("cc-divider-wave")).toBe(false);
    expect(callout.hasAttribute("role")).toBe(false);
    expect(callout.hasAttribute("aria-orientation")).toBe(false);
  });
});

describe("rendered section processing", () => {
  it("applies root state and decorates an enabled Reading View section", () => {
    const { root, section } = createFixture(
      '<hr><div class="callout" data-callout="divider" data-callout-metadata="glass"><div class="callout-title">Divider</div></div>',
    );

    processRenderedSection(section, DEFAULT_SETTINGS);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(root.dataset.ccDividerDefault).toBe("wave");
    expect(section.querySelector("hr")?.classList.contains("cc-divider")).toBe(
      true,
    );
    expect(
      section
        .querySelector(".callout")
        ?.classList.contains("cc-divider-glass"),
    ).toBe(true);
  });

  it("does not decorate when the divider feature is disabled", () => {
    const { root, section } = createFixture("<hr>");
    const settings = normalizeSettings({
      divider: { enabled: false },
    });

    processRenderedSection(section, settings);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(root.dataset.ccDividerDefault).toBeUndefined();
    expect(section.querySelector("hr")?.classList.contains("cc-divider")).toBe(
      false,
    );
  });

  it("clears stale divider classes when the feature is disabled", () => {
    const { section } = createFixture(
      '<hr class="cc-divider"><div class="callout cc-divider-callout cc-divider-wave" role="separator" aria-orientation="horizontal" data-callout="divider" data-callout-metadata="wave"><div class="callout-title">Divider</div></div>',
    );
    const settings = normalizeSettings({
      divider: { enabled: false },
    });

    processRenderedSection(section, settings);

    expect(section.querySelector("hr")?.classList.contains("cc-divider")).toBe(
      false,
    );
    const callout = getCallout(section, "wave");
    expect(callout.classList.contains("cc-divider-callout")).toBe(false);
    expect(callout.classList.contains("cc-divider-wave")).toBe(false);
    expect(callout.hasAttribute("role")).toBe(false);
    expect(callout.hasAttribute("aria-orientation")).toBe(false);
  });
});

describe("divider post processor registration", () => {
  it("registers the rendered-section processor during load", async () => {
    const { section } = createFixture("<hr>");
    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => []),
        on: vi.fn(() => ({})),
      },
    };
    const plugin = new CrispCraftPlugin(app as never, {} as never);

    await plugin.onload();

    expect(plugin.registerMarkdownPostProcessor).toHaveBeenCalledOnce();
    const processor = vi.mocked(plugin.registerMarkdownPostProcessor).mock
      .calls[0][0] as (el: HTMLElement, ctx: unknown) => void;
    const addChild = vi.fn();
    processor(section, { addChild });

    // Divider sections get a render-child lifetime so settings can refresh them.
    expect(addChild).toHaveBeenCalledOnce();

    expect(section.querySelector("hr")?.classList.contains("cc-divider")).toBe(
      true,
    );
  });

  it("removes divider decoration on plugin unload", () => {
    const { root, section } = createFixture(`
      <hr>
      <div class="callout" data-callout="divider" data-callout-metadata="wave">
        <div class="callout-title">Divider</div>
      </div>
    `);
    processRenderedSection(section, DEFAULT_SETTINGS);

    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl: root.parentElement });
    const plugin = new CrispCraftPlugin(
      {
        workspace: {
          getLeavesOfType: vi.fn(() => [{ view }]),
          on: vi.fn(() => ({})),
        },
      } as never,
      {} as never,
    );

    plugin.onunload();

    expect(section.querySelector("hr")?.classList.contains("cc-divider")).toBe(
      false,
    );
    const callout = getCallout(section, "wave");
    expect(callout.classList.contains("cc-divider-callout")).toBe(false);
    expect(callout.classList.contains("cc-divider-wave")).toBe(false);
    expect(callout.hasAttribute("role")).toBe(false);
    expect(callout.hasAttribute("aria-orientation")).toBe(false);
    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
  });
});

describe("divider CSS", () => {
  const css = fs.readFileSync(
    path.resolve(testDirectory, "../styles.css"),
    "utf8",
  );

  it.each([...DIVIDER_STYLES])(
    "defines scoped hr and callout rules for %s",
    (style: DividerStyle) => {
      expect(css).toContain(
        `.callout.cc-divider-callout.cc-divider-${style}`,
      );
      expect(css).toContain(
        `[data-cc-divider-default="${style}"] hr.cc-divider`,
      );
    },
  );

  it("uses the required original treatment families", () => {
    expect(css).toContain("-webkit-mask-image");
    expect(css).toContain("--cc-divider-background-color: var(--cc-accent)");
    expect(css).toContain("radial-gradient");
    expect(css).toContain("repeating-linear-gradient");
    expect(css).toContain("backdrop-filter: blur");
  });

  it("hardens native hr properties against theme !important rules", () => {
    expect(css).toContain("height: var(--cc-divider-height) !important");
    expect(css).toContain("margin: var(--cc-divider-gap) 0 !important");
    expect(css).toContain(
      "background-image: var(--cc-divider-background-image) !important",
    );
    expect(css).toContain(
      "background-repeat: var(--cc-divider-background-repeat) !important",
    );
  });
});
