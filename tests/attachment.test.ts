import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { MarkdownView } from "obsidian";
import { normalizeSettings } from "../src/settings";
import {
  clearAttachmentDecorations,
  decorateAttachments,
} from "../src/attachment";
import { processRenderedSection } from "../src/post-process";
import CrispCraftPlugin from "../src/main";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const SUPPORTED_EXTENSIONS = [
  "pdf",
  "zip",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "json",
  "txt",
  "mp3",
  "m4a",
  "wav",
  "flac",
  "ogg",
  "mp4",
  "mov",
  "webm",
  "m4v",
] as const;

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "heic",
] as const;

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

describe("attachment decoration", () => {
  it.each(SUPPORTED_EXTENSIONS)(
    "classifies a local .%s link",
    (extension) => {
      const { section } = createFixture(`
        <a class="internal-link" data-href="archive.${extension}" href="archive.${extension}">
          archive.${extension}
        </a>
      `);
      const link = section.querySelector("a") as HTMLAnchorElement;

      decorateAttachments(section, normalizeSettings({}));

      expect(link.classList.contains("cc-attachment")).toBe(true);
      expect(link.dataset.ccExt).toBe(extension);
    },
  );

  it("uses the captured local ZIP and PDF DOM without replacing links", () => {
    const { section } = createFixture(`
      <a class="internal-link" data-href="archive.zip" href="archive.zip">archive.zip</a>
      <a class="internal-link" data-href="report.pdf" href="report.pdf">report.pdf</a>
    `);
    const [zipLink, pdfLink] = [
      ...section.querySelectorAll<HTMLAnchorElement>("a"),
    ];

    decorateAttachments(section, normalizeSettings({}));

    expect(section.querySelectorAll("a")).toHaveLength(2);
    expect(section.querySelector("a")).toBe(zipLink);
    expect(zipLink.dataset.ccExt).toBe("zip");
    expect(pdfLink.dataset.ccExt).toBe("pdf");
  });

  it("normalizes extensions to lowercase", () => {
    const { section } = createFixture(
      '<a class="internal-link" data-href="REPORT.PDF" href="REPORT.PDF">REPORT.PDF</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;

    decorateAttachments(section, normalizeSettings({}));

    expect(link.dataset.ccExt).toBe("pdf");
  });

  it.each(IMAGE_EXTENSIONS)(
    "does not classify a local .%s image link",
    (extension) => {
      const { section } = createFixture(
        `<a class="internal-link" data-href="photo.${extension}" href="photo.${extension}">photo.${extension}</a>`,
      );
      const link = section.querySelector("a") as HTMLAnchorElement;

      decorateAttachments(section, normalizeSettings({}));

      expect(link.classList.contains("cc-attachment")).toBe(false);
      expect(link.hasAttribute("data-cc-ext")).toBe(false);
    },
  );

  it("leaves external attachment-looking links untouched", () => {
    const { section } = createFixture(
      '<a class="external-link" href="https://example.com/file.zip">remote</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;

    decorateAttachments(section, normalizeSettings({}));

    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
  });

  it("supports stable file-embed DOM and excludes image embeds", () => {
    const { section } = createFixture(`
      <span class="internal-embed file-embed mod-generic is-loaded" src="archive.zip">
        <div class="file-embed-title">
          <span class="file-embed-icon">icon</span>
          archive.zip
        </div>
      </span>
      <span class="internal-embed is-loaded file-embed mod-empty-attachment" src="sample.pdf">
        找不到“sample.pdf”。
      </span>
      <span class="internal-embed media-embed image-embed is-loaded" src="photo.png">
        <img src="photo.png" alt="">
      </span>
    `);
    const fileEmbed = section.querySelector(".file-embed") as HTMLElement;
    const missingEmbed = section.querySelector(
      ".mod-empty-attachment",
    ) as HTMLElement;
    const imageEmbed = section.querySelector(".image-embed") as HTMLElement;

    decorateAttachments(section, normalizeSettings({}));

    expect(fileEmbed.classList.contains("cc-attachment")).toBe(true);
    expect(fileEmbed.dataset.ccExt).toBe("zip");
    expect(missingEmbed.classList.contains("cc-attachment")).toBe(true);
    expect(missingEmbed.dataset.ccExt).toBe("pdf");
    expect(imageEmbed.classList.contains("cc-attachment")).toBe(false);
    expect(imageEmbed.hasAttribute("data-cc-ext")).toBe(false);
  });

  it("is idempotent and does not alter children", () => {
    const { section } = createFixture(`
      <a class="internal-link" data-href="report.pdf" href="report.pdf">
        <span>report.pdf</span>
      </a>
    `);
    const link = section.querySelector("a") as HTMLAnchorElement;
    const child = link.firstElementChild;

    decorateAttachments(section, normalizeSettings({}));
    decorateAttachments(section, normalizeSettings({}));

    expect(link.classList.toString().match(/cc-attachment/g)).toHaveLength(1);
    expect(link.dataset.ccExt).toBe("pdf");
    expect(link.firstElementChild).toBe(child);
    expect(link.childElementCount).toBe(1);
  });

  it("does not replace or intercept native click handlers", () => {
    const { dom, section } = createFixture(
      '<a class="internal-link" data-href="archive.zip" href="archive.zip">archive.zip</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;
    const listener = vi.fn();
    const nativeOnClick = vi.fn();
    link.addEventListener("click", listener);
    link.onclick = nativeOnClick;

    decorateAttachments(section, normalizeSettings({}));
    link.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(nativeOnClick).toHaveBeenCalledOnce();
    expect(link.onclick).toBe(nativeOnClick);
  });

  it("clears attachment decorations without touching native nodes", () => {
    const { section } = createFixture(
      '<a class="internal-link other-class cc-attachment" data-href="archive.zip" href="archive.zip" data-cc-ext="zip">archive.zip</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;

    clearAttachmentDecorations(section);

    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.classList.contains("other-class")).toBe(true);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
    expect(link.dataset.href).toBe("archive.zip");
  });
});

describe("attachment rendered-section integration", () => {
  it("decorates attachments only when the feature is enabled", () => {
    const { root, section } = createFixture(`
      <a class="internal-link" data-href="archive.zip" href="archive.zip">archive.zip</a>
      <a class="internal-link" data-href="report.pdf" href="report.pdf">report.pdf</a>
    `);
    const settings = normalizeSettings({});

    processRenderedSection(section, settings);

    expect(root.dataset.ccAttachmentStyle).toBe("compact");
    expect(section.querySelector('[data-cc-ext="zip"]')).not.toBeNull();
    expect(section.querySelector('[data-cc-ext="pdf"]')).not.toBeNull();
  });

  it("clears stale attachment classes and data when disabled", () => {
    const { root, section } = createFixture(
      '<a class="internal-link cc-attachment" data-cc-ext="zip" data-href="archive.zip" href="archive.zip">archive.zip</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;
    const settings = normalizeSettings({
      attachment: { enabled: false },
    });

    processRenderedSection(section, settings);

    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
    expect(root.dataset.ccAttachmentStyle).toBeUndefined();
  });

  it("clears stale attachment classes and data when globally disabled", () => {
    const { section } = createFixture(
      '<a class="internal-link cc-attachment" data-cc-ext="zip" data-href="archive.zip" href="archive.zip">archive.zip</a>',
    );
    const link = section.querySelector("a") as HTMLAnchorElement;
    const settings = normalizeSettings({ enabled: false });

    processRenderedSection(section, settings);

    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
  });

  it("removes attachment decoration on plugin unload", () => {
    const { root, section } = createFixture(
      '<a class="internal-link" data-href="archive.zip" href="archive.zip">archive.zip</a>',
    );
    processRenderedSection(section, normalizeSettings({}));
    const link = section.querySelector("a") as HTMLAnchorElement;
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

    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
  });
});

describe("attachment CSS", () => {
  const css = fs.readFileSync(
    path.resolve(testDirectory, "../styles.css"),
    "utf8",
  );

  it("defines compact and soft styles under the Reading View scope", () => {
    expect(css).toContain(
      '.markdown-reading-view.crisp-craft-enabled[data-cc-attachment-style="compact"]',
    );
    expect(css).toContain(
      '.markdown-reading-view.crisp-craft-enabled[data-cc-attachment-style="soft"]',
    );
    expect(css).toContain("content: attr(data-cc-ext)");
    expect(css).toContain("text-transform: uppercase");
    expect(css).toContain("backdrop-filter: blur");
    expect(css).toContain(".file-embed-icon");
  });
});
