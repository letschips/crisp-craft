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
} from "../src/settings";
import {
  applyRootState,
  clearRootState,
  refreshAllReadingRoots,
} from "../src/root-state";
import CrispCraftPlugin from "../src/main";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(
  path.resolve(testDirectory, "../styles.css"),
  "utf8",
);
const CRISP_ROOT = ".markdown-reading-view.crisp-craft-enabled";

function createRoot(html = '<div class="markdown-reading-view"></div>') {
  const dom = new JSDOM(html);
  return {
    dom,
    root: dom.window.document.querySelector("div") as HTMLElement,
  };
}

function ruleBlock(selector: string): string {
  const normalize = (value: string): string =>
    value
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .replace(/\s*,\s*/g, ", ");
  const escapedSelector = normalize(selector).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const match = normalize(css).match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  return match[1];
}

function tokenBlock(suffix = ""): string {
  return ruleBlock(`${CRISP_ROOT}${suffix}`);
}

describe("Reading View root state", () => {
  it("applies scoped class and preset data", () => {
    const { root } = createRoot();

    applyRootState(root, DEFAULT_SETTINGS);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(root.dataset.ccIntensity).toBe("balanced");
    expect(root.dataset.ccAccentSource).toBe("crisp");
    expect(root.dataset.ccDividerDefault).toBe("wave");
    expect(root.dataset.ccHeadingStyle).toBe("editorial");
    expect(root.dataset.ccQuoteStyle).toBe("glass-edge");
    expect(root.dataset.ccImageFrame).toBe("subtle");
    expect(root.dataset.ccImageRounded).toBe("true");
    expect(root.dataset.ccAttachmentStyle).toBe("compact");
    expect(root.dataset.ccTable).toBe("true");
  });

  it("removes all Crisp Craft state on clear", () => {
    const { root } = createRoot(
      '<div class="markdown-reading-view crisp-craft-enabled" data-cc-intensity="rich"></div>',
    );
    root.style.setProperty("--cc-user-accent", "#AABBCC");

    clearRootState(root);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect([...root.attributes].some((a) => a.name.startsWith("data-cc-"))).toBe(
      false,
    );
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("");
  });

  it("only mounts component state for enabled components", () => {
    const { root } = createRoot();
    const settings = normalizeSettings({
      divider: { enabled: false },
      heading: { enabled: false },
      quote: { enabled: false },
      image: { enabled: false },
      attachment: { enabled: false },
      table: { enabled: false },
    });

    applyRootState(root, settings);

    expect(root.dataset.ccIntensity).toBe("balanced");
    expect(root.dataset.ccAccentSource).toBe("crisp");
    expect(root.dataset.ccDividerDefault).toBeUndefined();
    expect(root.dataset.ccHeadingStyle).toBeUndefined();
    expect(root.dataset.ccQuoteStyle).toBeUndefined();
    expect(root.dataset.ccImageFrame).toBeUndefined();
    expect(root.dataset.ccImageRounded).toBeUndefined();
    expect(root.dataset.ccAttachmentStyle).toBeUndefined();
    expect(root.dataset.ccTable).toBeUndefined();
  });

  it("clears all mounted state when globally disabled", () => {
    const { root } = createRoot(
      '<div class="markdown-reading-view crisp-craft-enabled" data-cc-intensity="rich"></div>',
    );
    const settings: CrispCraftSettings = {
      ...DEFAULT_SETTINGS,
      enabled: false,
    };

    applyRootState(root, settings);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect([...root.attributes].some((a) => a.name.startsWith("data-cc-"))).toBe(
      false,
    );
  });

  it("routes custom accent only for custom source and clears it for crisp or obsidian", () => {
    const { root } = createRoot();
    const custom = normalizeSettings({
      divider: { accentSource: "custom", customAccent: "#abc" },
    });
    const obsidian = normalizeSettings({
      divider: { accentSource: "obsidian" },
    });

    applyRootState(root, custom);
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("#AABBCC");
    expect(root.dataset.ccAccentSource).toBe("custom");

    applyRootState(root, DEFAULT_SETTINGS);
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("");
    expect(root.dataset.ccAccentSource).toBe("crisp");

    applyRootState(root, custom);
    applyRootState(root, obsidian);
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("");
    expect(root.dataset.ccAccentSource).toBe("obsidian");
  });

  it("keeps custom accent state when dividers are disabled", () => {
    const { root } = createRoot();
    const settings = normalizeSettings({
      divider: { enabled: false, accentSource: "custom", customAccent: "#abc" },
      heading: { enabled: true },
    });

    applyRootState(root, settings);

    expect(root.dataset.ccAccentSource).toBe("custom");
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("#AABBCC");
    expect(root.dataset.ccDividerDefault).toBeUndefined();
    expect(root.dataset.ccHeadingStyle).toBe("editorial");
  });

  it("keeps obsidian accent source state when dividers are disabled", () => {
    const { root } = createRoot();
    const settings = normalizeSettings({
      divider: { enabled: false, accentSource: "obsidian" },
      heading: { enabled: true },
    });

    applyRootState(root, settings);

    expect(root.dataset.ccAccentSource).toBe("obsidian");
    expect(root.style.getPropertyValue("--cc-user-accent")).toBe("");
    expect(root.dataset.ccDividerDefault).toBeUndefined();
    expect(root.dataset.ccHeadingStyle).toBe("editorial");
  });

  it("does not mount state on a Source View root", () => {
    const { root } = createRoot('<div class="markdown-source-view"></div>');

    applyRootState(root, DEFAULT_SETTINGS);

    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect([...root.attributes].some((a) => a.name.startsWith("data-cc-"))).toBe(
      false,
    );
  });

  it("refreshes only Reading View roots in preview Markdown leaves", () => {
    const dom = new JSDOM(`
      <div class="view-content">
        <div class="markdown-reading-view"></div>
      </div>
    `);
    const containerEl = dom.window.document.querySelector(
      ".view-content",
    ) as HTMLElement;
    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl });
    vi.spyOn(view, "getMode").mockReturnValue("preview");

    const sourceView = new MarkdownView({} as never);
    vi.spyOn(sourceView, "getMode").mockReturnValue("source");

    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [
          { view },
          { view: sourceView },
        ]),
      },
    };

    refreshAllReadingRoots(app as never, DEFAULT_SETTINGS);

    const root = containerEl.querySelector(
      ".markdown-reading-view",
    ) as HTMLElement;
    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(root.dataset.ccIntensity).toBe("balanced");
  });

  it("reclassifies cached Reading View content during root refresh", () => {
    const dom = new JSDOM(`
      <div class="view-content">
        <div class="markdown-reading-view">
          <div class="markdown-preview-section">
            <div class="el-hr"><hr></div>
            <div class="el-div">
              <div class="callout" data-callout="divider" data-callout-metadata="glass">
                <div class="callout-title">Divider</div>
              </div>
            </div>
            <p>
              <a class="internal-link" data-href="sample.pdf" href="sample.pdf">sample.pdf</a>
            </p>
          </div>
        </div>
      </div>
    `);
    const containerEl = dom.window.document.querySelector(
      ".view-content",
    ) as HTMLElement;
    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl });
    vi.spyOn(view, "getMode").mockReturnValue("preview");

    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [{ view }]),
      },
    };

    refreshAllReadingRoots(app as never, DEFAULT_SETTINGS);

    const hr = containerEl.querySelector("hr") as HTMLHRElement;
    const divider = containerEl.querySelector(
      '[data-callout="divider"]',
    ) as HTMLElement;
    const attachment = containerEl.querySelector("a") as HTMLAnchorElement;

    expect(hr.classList.contains("cc-divider")).toBe(true);
    expect(divider.classList.contains("cc-divider-callout")).toBe(true);
    expect(divider.classList.contains("cc-divider-glass")).toBe(true);
    expect(divider.getAttribute("role")).toBe("separator");
    expect(attachment.classList.contains("cc-attachment")).toBe(true);
    expect(attachment.dataset.ccExt).toBe("pdf");
  });

  it("clears cached component decoration when refresh is disabled", () => {
    const dom = new JSDOM(`
      <div class="view-content">
        <div class="markdown-reading-view crisp-craft-enabled">
          <div class="markdown-preview-section">
            <hr class="cc-divider">
            <div class="callout cc-divider-callout cc-divider-wave" role="separator"
              aria-orientation="horizontal" data-callout="divider"
              data-callout-metadata="wave">
              <div class="callout-title">Divider</div>
            </div>
            <a class="internal-link cc-attachment" data-cc-ext="pdf"
              data-href="sample.pdf" href="sample.pdf">sample.pdf</a>
          </div>
        </div>
      </div>
    `);
    const containerEl = dom.window.document.querySelector(
      ".view-content",
    ) as HTMLElement;
    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl });
    vi.spyOn(view, "getMode").mockReturnValue("preview");

    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [{ view }]),
      },
    };
    const settings = normalizeSettings({ enabled: false });

    refreshAllReadingRoots(app as never, settings);

    const root = containerEl.querySelector(
      ".markdown-reading-view",
    ) as HTMLElement;
    const hr = containerEl.querySelector("hr") as HTMLHRElement;
    const divider = containerEl.querySelector(
      '[data-callout="divider"]',
    ) as HTMLElement;
    const attachment = containerEl.querySelector("a") as HTMLAnchorElement;

    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect(hr.classList.contains("cc-divider")).toBe(false);
    expect(divider.classList.contains("cc-divider-callout")).toBe(false);
    expect(divider.hasAttribute("role")).toBe(false);
    expect(divider.hasAttribute("aria-orientation")).toBe(false);
    expect(attachment.classList.contains("cc-attachment")).toBe(false);
    expect(attachment.hasAttribute("data-cc-ext")).toBe(false);
  });

  it("refreshes mounted Reading roots in a source-mode leaf without mutating Source Mode", () => {
    const dom = new JSDOM(`
      <div class="view-content">
        <div class="markdown-source-view"></div>
        <div class="markdown-reading-view"></div>
      </div>
    `);
    const containerEl = dom.window.document.querySelector(
      ".view-content",
    ) as HTMLElement;
    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl });
    vi.spyOn(view, "getMode").mockReturnValue("source");

    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [{ view }]),
      },
    };

    refreshAllReadingRoots(app as never, DEFAULT_SETTINGS);

    const readingRoot = containerEl.querySelector(
      ".markdown-reading-view",
    ) as HTMLElement;
    const sourceRoot = containerEl.querySelector(
      ".markdown-source-view",
    ) as HTMLElement;
    expect(readingRoot.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(readingRoot.dataset.ccIntensity).toBe("balanced");
    expect(sourceRoot.classList.contains("crisp-craft-enabled")).toBe(false);
    expect(
      [...sourceRoot.attributes].some((a) => a.name.startsWith("data-cc-")),
    ).toBe(false);
  });
});

describe("Reading View CSS tokens", () => {
  it("defines the stable internal token layer on the scoped root", () => {
    const root = tokenBlock();
    const tokens = [
      "--cc-accent",
      "--cc-accent-soft",
      "--cc-text",
      "--cc-muted",
      "--cc-border",
      "--cc-surface",
      "--cc-surface-strong",
      "--cc-radius-sm",
      "--cc-radius-md",
      "--cc-radius-lg",
      "--cc-shadow-color",
      "--cc-shadow-soft",
      "--cc-shadow-attachment",
      "--cc-shadow-attachment-soft",
      "--cc-shadow-image-subtle",
      "--cc-shadow-image-glass",
      "--cc-blur",
    ];

    for (const token of tokens) {
      expect(root).toContain(`${token}:`);
    }

    expect(root).toMatch(
      /--cc-accent:\s*var\(\s*--cs-accent-primary,\s*var\(--interactive-accent,\s*var\(--color-accent,\s*#6b84bf\)\s*\)\s*\)/s,
    );
    expect(root).toContain("--cc-text: var(--text-normal, #1f2328)");
    expect(root).toContain("--cc-muted: var(--text-muted, #667085)");
    expect(root).toContain("--cc-border:");
    expect(root).toContain("--cc-surface:");
    expect(root).toContain("--cc-surface-strong:");
    expect(root).toMatch(
      /--cc-surface:\s*color-mix\([\s\S]*?transparent\s*\);/,
    );
    expect(root).toMatch(
      /--cc-surface-strong:\s*color-mix\([\s\S]*?transparent\s*\);/,
    );
    expect(root).toMatch(
      /--cc-shadow-soft:\s*var\(\s*--shadow-s,\s*0 1px 5px var\(--cc-shadow-color\)\s*\)/s,
    );
    expect(root).not.toContain("--background-primary");
  });

  it("routes obsidian and custom accent sources explicitly", () => {
    expect(tokenBlock('[data-cc-accent-source="obsidian"]')).toMatch(
      /--cc-accent:\s*var\(--interactive-accent,\s*var\(--color-accent,\s*#6b84bf\)\s*\)/s,
    );
    expect(tokenBlock('[data-cc-accent-source="custom"]')).toMatch(
      /--cc-accent:\s*var\(\s*--cc-user-accent,/s,
    );
  });

  it("preserves component shadow geometry through scoped tokens", () => {
    const root = tokenBlock();
    const attachment = ruleBlock(
      `${CRISP_ROOT} :is(a.cc-attachment, span.cc-attachment)`,
    );
    const softAttachment = ruleBlock(
      `${CRISP_ROOT}[data-cc-attachment-style="soft"] :is(a.cc-attachment, span.cc-attachment)`,
    );
    const subtleImage = ruleBlock(
      `${CRISP_ROOT}[data-cc-image-frame="subtle"] .markdown-preview-section :is(.image-embed, .media-embed):has(> img)`,
    );
    const glassImage = ruleBlock(
      `${CRISP_ROOT}[data-cc-image-frame="glass"] .markdown-preview-section :is(.image-embed, .media-embed):has(> img)`,
    );

    expect(root).toContain(
      "--cc-shadow-attachment: 0 1px 4px var(--cc-shadow-color);",
    );
    expect(root).toContain(
      "--cc-shadow-attachment-soft: 0 2px 8px var(--cc-shadow-color);",
    );
    expect(root).toContain(
      "--cc-shadow-image-subtle: 0 2px 10px var(--cc-shadow-color);",
    );
    expect(root).toContain(
      "--cc-shadow-image-glass: 0 8px 20px var(--cc-shadow-color);",
    );
    expect(attachment).toContain("var(--cc-shadow-attachment)");
    expect(softAttachment).toContain("var(--cc-shadow-attachment-soft)");
    expect(subtleImage).toContain("var(--cc-shadow-image-subtle)");
    expect(glassImage).toContain("var(--cc-shadow-image-glass)");
  });

  it("orders intensity tokens from subtle to balanced to rich", () => {
    const strength = (suffix: string, token: string): number => {
      const match = tokenBlock(suffix).match(
        new RegExp(`${token}:\\s*([0-9.]+)%?`),
      );
      if (!match) throw new Error(`Missing ${token} for ${suffix}`);
      return Number(match[1]);
    };

    for (const token of [
      "--cc-divider-opacity",
      "--cc-surface-strength",
      "--cc-shadow-strength",
      "--cc-marker-scale",
    ]) {
      const subtle = strength('[data-cc-intensity="subtle"]', token);
      const balanced = strength('[data-cc-intensity="balanced"]', token);
      const rich = strength('[data-cc-intensity="rich"]', token);

      expect(subtle).toBeLessThan(balanced);
      expect(balanced).toBeLessThan(rich);
    }
  });
});

describe("Reading View root state lifecycle", () => {
  function createLifecycleApp() {
    const dom = new JSDOM(`
      <div class="view-content">
        <div class="markdown-reading-view"></div>
      </div>
    `);
    const containerEl = dom.window.document.querySelector(
      ".view-content",
    ) as HTMLElement;
    const view = new MarkdownView({} as never);
    Object.assign(view, { containerEl });
    vi.spyOn(view, "getMode").mockReturnValue("preview");

    const listeners = new Map<string, (...args: never[]) => unknown>();
    const workspace = {
      getLeavesOfType: vi.fn(() => [{ view }]),
      on: vi.fn((name: string, callback: (...args: never[]) => unknown) => {
        listeners.set(name, callback);
        return { name };
      }),
    };
    const app = { workspace };
    const plugin = new CrispCraftPlugin(app as never, {} as never);
    const registerEvent = vi.fn((eventRef: unknown) => eventRef);
    Object.assign(plugin, { registerEvent });

    return { app, containerEl, listeners, plugin, registerEvent };
  }

  it("refreshes mounted Reading View roots on layout and leaf changes", async () => {
    const { containerEl, listeners, plugin, registerEvent } =
      createLifecycleApp();

    await plugin.onload();

    expect(registerEvent).toHaveBeenCalledTimes(2);
    expect([...listeners.keys()]).toEqual([
      "layout-change",
      "active-leaf-change",
    ]);

    const root = containerEl.querySelector(
      ".markdown-reading-view",
    ) as HTMLElement;
    clearRootState(root);
    listeners.get("layout-change")?.();

    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    expect(root.dataset.ccIntensity).toBe("balanced");
  });

  it("clears mounted Reading View root state on unload", () => {
    const { containerEl, plugin } = createLifecycleApp();
    const root = containerEl.querySelector(
      ".markdown-reading-view",
    ) as HTMLElement;
    applyRootState(root, DEFAULT_SETTINGS);

    plugin.onunload();

    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect([...root.attributes].some((a) => a.name.startsWith("data-cc-"))).toBe(
      false,
    );
  });
});
