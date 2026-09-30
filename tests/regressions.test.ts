import { describe, expect, it } from "vitest";
import { applyRootState } from "../src/root-state";
import { DEFAULT_SETTINGS } from "../src/settings";
import { decorateDividers, clearDividerDecorations } from "../src/divider";
import { decorateAttachments, clearAttachmentDecorations } from "../src/attachment";
import { processRenderedSection } from "../src/post-process";

describe("decoration lifecycle regressions", () => {
  it("restores existing callout accessibility attributes after repeated decoration", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="callout" data-callout="divider" role="note" aria-orientation="vertical"><div class="callout-title">Divider</div></div>';
    const callout = root.firstElementChild!;
    decorateDividers(root, DEFAULT_SETTINGS);
    decorateDividers(root, DEFAULT_SETTINGS);
    clearDividerDecorations(root);
    expect(callout.getAttribute("role")).toBe("note");
    expect(callout.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("cleans a divider even after its callout type changes", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="callout" data-callout="divider"><div class="callout-title">Divider</div></div>';
    const callout = root.firstElementChild!;
    decorateDividers(root, DEFAULT_SETTINGS);
    callout.setAttribute("data-callout", "note");
    decorateDividers(root, DEFAULT_SETTINGS);
    expect(callout.classList.contains("cc-divider-callout")).toBe(false);
    expect(callout.hasAttribute("role")).toBe(false);
  });

  it.each(["refresh", "clear"])("removes stale attachment badges on %s after a link becomes external", (operation) => {
    const root = document.createElement("div");
    root.innerHTML = '<a class="internal-link" href="sample.pdf">Sample</a>';
    const link = root.firstElementChild!;
    decorateAttachments(root, DEFAULT_SETTINGS);
    link.classList.replace("internal-link", "external-link");
    if (operation === "refresh") decorateAttachments(root, DEFAULT_SETTINGS);
    else clearAttachmentDecorations(root);
    expect(link.classList.contains("cc-attachment")).toBe(false);
    expect(link.hasAttribute("data-cc-ext")).toBe(false);
  });

  it("does not rewrite unchanged root attributes during section processing", () => {
    const root = document.createElement("div");
    root.className = "markdown-reading-view";
    applyRootState(root, DEFAULT_SETTINGS);
    const observer = new MutationObserver(() => {});
    observer.observe(root, { attributes: true });
    applyRootState(root, DEFAULT_SETTINGS);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  // Obsidian runs post-processors on sections before attaching them to the
  // Reading View, so decoration must not depend on finding the root first.
  it("decorates a section that is still detached when first processed", async () => {
    const section = document.createElement("div");
    section.innerHTML =
      '<div class="callout" data-callout="divider"><div class="callout-title">Divider</div></div>' +
      '<a class="internal-link" data-href="report.pdf">report.pdf</a>';
    processRenderedSection(section, DEFAULT_SETTINGS);
    expect(section.querySelector(".callout")!.classList.contains("cc-divider-callout")).toBe(true);
    expect(section.querySelector("a")!.dataset.ccExt).toBe("pdf");

    const root = document.createElement("div");
    root.className = "markdown-reading-view";
    root.appendChild(section);
    document.body.appendChild(root);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(root.classList.contains("crisp-craft-enabled")).toBe(true);
    root.remove();
  });
});
