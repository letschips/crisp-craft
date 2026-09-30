import { MarkdownView, type App } from "obsidian";
import {
  clearAttachmentDecorations,
  decorateAttachments,
} from "./attachment";
import { clearDividerDecorations, decorateDividers } from "./divider";
import type { CrispCraftSettings } from "./settings";

const ENABLED_CLASS = "crisp-craft-enabled";
const CUSTOM_ACCENT_PROPERTY = "--cc-user-accent";

export function clearRootState(root: HTMLElement): void {
  root.classList.remove(ENABLED_CLASS);

  for (const attribute of [...root.attributes]) {
    if (attribute.name.startsWith("data-cc-")) {
      root.removeAttribute(attribute.name);
    }
  }

  root.style.removeProperty(CUSTOM_ACCENT_PROPERTY);
}

export function applyRootState(
  root: HTMLElement,
  settings: CrispCraftSettings,
): void {
  if (!root.classList.contains("markdown-reading-view") || !settings.enabled) {
    clearRootState(root);
    return;
  }

  const attributes: Record<string, string> = {
    "data-cc-intensity": settings.intensity,
    "data-cc-accent-source": settings.divider.accentSource,
  };
  if (settings.divider.enabled) attributes["data-cc-divider-default"] = settings.divider.defaultStyle;
  if (settings.heading.enabled) attributes["data-cc-heading-style"] = settings.heading.style;
  if (settings.quote.enabled) attributes["data-cc-quote-style"] = settings.quote.style;
  if (settings.image.enabled) {
    attributes["data-cc-image-frame"] = settings.image.frame;
    attributes["data-cc-image-rounded"] = String(settings.image.rounded);
  }
  if (settings.attachment.enabled) attributes["data-cc-attachment-style"] = settings.attachment.style;
  if (settings.table.enabled) attributes["data-cc-table"] = "true";

  // Each rendered section shares this root. Avoid invalidating its entire
  // stylesheet scope again when scrolling mounts another unchanged section.
  if (!root.classList.contains(ENABLED_CLASS)) root.classList.add(ENABLED_CLASS);
  for (const attribute of [...root.attributes]) {
    if (attribute.name.startsWith("data-cc-") && !(attribute.name in attributes)) {
      root.removeAttribute(attribute.name);
    }
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (root.getAttribute(name) !== value) root.setAttribute(name, value);
  }
  const accent = settings.divider.accentSource === "custom" ? settings.divider.customAccent : "";
  if (root.style.getPropertyValue(CUSTOM_ACCENT_PROPERTY) !== accent) {
    if (accent) root.style.setProperty(CUSTOM_ACCENT_PROPERTY, accent);
    else root.style.removeProperty(CUSTOM_ACCENT_PROPERTY);
  }
}

function refreshReadingRoot(
  root: HTMLElement,
  settings: CrispCraftSettings,
): void {
  applyRootState(root, settings);

  if (settings.enabled && settings.divider.enabled) {
    decorateDividers(root, settings);
  } else {
    clearDividerDecorations(root);
  }

  if (settings.enabled && settings.attachment.enabled) {
    decorateAttachments(root, settings);
  } else {
    clearAttachmentDecorations(root);
  }
}

function getReadingRoots(app: App): HTMLElement[] {
  const roots: HTMLElement[] = [];

  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) continue;

    const containerEl = view.containerEl;
    if (!containerEl) continue;

    roots.push(
      ...containerEl.querySelectorAll<HTMLElement>(".markdown-reading-view"),
    );
  }

  return roots;
}

export function refreshAllReadingRoots(
  app: App,
  settings: CrispCraftSettings,
): void {
  for (const root of getReadingRoots(app)) {
    refreshReadingRoot(root, settings);
  }
}

// Workspace events only need the root flags; sections are decorated by the
// post-processor, so rescanning every note on each tab switch is wasted work.
export function applyAllRootStates(
  app: App,
  settings: CrispCraftSettings,
): void {
  for (const root of getReadingRoots(app)) {
    applyRootState(root, settings);
  }
}
