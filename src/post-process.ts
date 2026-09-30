import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import type { CrispCraftSettings } from "./settings";
import {
  clearAttachmentDecorations,
  decorateAttachments,
} from "./attachment";
import { clearDividerDecorations, decorateDividers } from "./divider";
import { applyRootState } from "./root-state";

// Keep native cached sections current without forcing a Markdown rerender.
// Obsidian unloads each child when its section is discarded.
const renderedSections = new Set<HTMLElement>();

const TRACKED_TARGETS = "hr, .callout[data-callout='divider'], a.internal-link, span.internal-embed.file-embed";

class SectionLifetime extends MarkdownRenderChild {
  onunload(): void {
    const el = this.containerEl;
    renderedSections.delete(el);
    pendingSections.delete(el);
    clearDividerDecorations(el);
    clearAttachmentDecorations(el);
  }
}

export function trackRenderedSection(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  // Typography, images and tables are CSS-only. Retain just sections whose
  // divider/link classification needs refreshing while the native cache lives.
  if (el.isConnected && !el.closest(".markdown-reading-view")) return;
  if (!el.matches(TRACKED_TARGETS) && !el.querySelector(TRACKED_TARGETS)) return;
  if (renderedSections.has(el)) return;
  renderedSections.add(el);
  ctx.addChild(new SectionLifetime(el));
}

export function refreshProcessedSections(settings: CrispCraftSettings): void {
  for (const section of renderedSections) processRenderedSection(section, settings);
}

const pendingSections = new Set<HTMLElement>();
let pendingSettings: CrispCraftSettings | null = null;
const pendingFrames = new Map<Window, number>();

export function cancelPendingSections(): void {
  for (const [host, frame] of pendingFrames) host.cancelAnimationFrame(frame);
  pendingFrames.clear();
  for (const section of renderedSections) {
    clearDividerDecorations(section);
    clearAttachmentDecorations(section);
  }
  renderedSections.clear();
  for (const section of pendingSections) {
    clearDividerDecorations(section);
    clearAttachmentDecorations(section);
  }
  pendingSections.clear();
  pendingSettings = null;
}

// Obsidian hands post-processors detached sections on first render. Apply the
// root state once they are mounted, batching every section into one frame.
function applyRootStateWhenMounted(
  el: HTMLElement,
  settings: CrispCraftSettings,
): void {
  pendingSections.add(el);
  pendingSettings = settings;
  const host = el.ownerDocument.defaultView;
  if (!host || pendingFrames.has(host)) return;

  pendingFrames.set(host, host.requestAnimationFrame(() => {
    pendingFrames.delete(host);
    const sections = [...pendingSections].filter(section => section.ownerDocument.defaultView === host);
    const latest = pendingSettings;
    for (const section of sections) pendingSections.delete(section);
    if (!pendingSections.size) pendingSettings = null;
    if (!latest) return;

    const roots = new Set<HTMLElement>();
    for (const section of sections) {
      const root = section.closest<HTMLElement>(".markdown-reading-view");
      if (root) roots.add(root);
      else if (section.isConnected) {
        clearDividerDecorations(section);
        clearAttachmentDecorations(section);
      }
    }
    for (const root of roots) applyRootState(root, latest);
  }));
}

export function processRenderedSection(
  el: HTMLElement,
  settings: CrispCraftSettings,
): void {
  const root = el.closest<HTMLElement>(".markdown-reading-view");
  if (!root && el.isConnected) {
    clearDividerDecorations(el);
    clearAttachmentDecorations(el);
    return;
  }
  if (root) {
    applyRootState(root, settings);
  } else {
    applyRootStateWhenMounted(el, settings);
  }

  if (settings.enabled && settings.divider.enabled) {
    decorateDividers(el, settings);
  } else {
    clearDividerDecorations(el);
  }

  if (settings.enabled && settings.attachment.enabled) {
    decorateAttachments(el, settings);
  } else {
    clearAttachmentDecorations(el);
  }
}
