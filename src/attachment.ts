import type { CrispCraftSettings } from "./settings";

const ATTACHMENT_EXTENSIONS = new Set([
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
]);

const ATTACHMENT_TARGET_SELECTOR = [
  "a.internal-link:not(.external-link)",
  "span.internal-embed.file-embed:not(.media-embed):not(.image-embed)",
].join(", ");

function getExtension(value: string | null | undefined): string | null {
  if (!value) return null;

  const path = value.trim().split(/[?#]/, 1)[0];
  const match = /\.([^./\\]+)$/.exec(path);

  return match ? match[1].toLowerCase() : null;
}

function resolveAttachmentExtension(node: HTMLElement): string | null {
  if (node.tagName === "A") {
    const href = node.getAttribute("data-href") ?? node.getAttribute("href");
    const extension = getExtension(href);

    return extension && ATTACHMENT_EXTENSIONS.has(extension) ? extension : null;
  }

  if (
    node.tagName === "SPAN" &&
    node.classList.contains("internal-embed") &&
    node.classList.contains("file-embed") &&
    !node.classList.contains("media-embed") &&
    !node.classList.contains("image-embed")
  ) {
    const extension = getExtension(
      node.getAttribute("src") ?? node.getAttribute("data-src"),
    );

    return extension && ATTACHMENT_EXTENSIONS.has(extension) ? extension : null;
  }

  return null;
}

function getDecoratorTargets(el: HTMLElement): HTMLElement[] {
  const targets = [
    ...el.querySelectorAll<HTMLElement>(`${ATTACHMENT_TARGET_SELECTOR}, .cc-attachment`),
  ];

  if (el.matches(`${ATTACHMENT_TARGET_SELECTOR}, .cc-attachment`)) {
    targets.unshift(el);
  }

  return targets;
}

function clearAttachmentDecoration(target: HTMLElement): void {
  if (target.classList.contains("cc-attachment")) target.classList.remove("cc-attachment");
  if (target.hasAttribute("data-cc-ext")) target.removeAttribute("data-cc-ext");
}

export function clearAttachmentDecorations(el: HTMLElement): void {
  for (const target of getDecoratorTargets(el)) {
    clearAttachmentDecoration(target);
  }
}

export function decorateAttachments(
  el: HTMLElement,
  settings: CrispCraftSettings,
): void {
  if (!settings.attachment.enabled) {
    clearAttachmentDecorations(el);
    return;
  }

  for (const target of getDecoratorTargets(el)) {
    const extension = target.matches(ATTACHMENT_TARGET_SELECTOR)
      ? resolveAttachmentExtension(target)
      : null;

    if (!extension) {
      clearAttachmentDecoration(target);
      continue;
    }

    if (!target.classList.contains("cc-attachment")) target.classList.add("cc-attachment");
    if (target.dataset.ccExt !== extension) target.dataset.ccExt = extension;
  }
}
