import type {
  CrispCraftSettings,
  DividerStyle,
} from "./settings";

export const DIVIDER_STYLES = new Set<DividerStyle>([
  "wave",
  "minimal",
  "dots",
  "brush",
  "tape",
  "glass",
]);

const originalAccessibility = new WeakMap<HTMLElement, { role: string | null; orientation: string | null }>();

const DIVIDER_CALLOUT_CLASSES = [
  "cc-divider-callout",
  ...[...DIVIDER_STYLES].map((style) => `cc-divider-${style}`),
];

function getDecoratorTargets(el: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];

  if (el.matches("hr, .callout[data-callout='divider'], .cc-divider-callout")) {
    targets.push(el);
  }

  targets.push(
    ...el.querySelectorAll<HTMLElement>(
      "hr, .callout[data-callout='divider'], .cc-divider-callout",
    ),
  );

  return targets;
}

function hasMeaningfulContent(callout: HTMLElement): boolean {
  if (callout.querySelector(":scope > .callout-content")) {
    return true;
  }

  for (const child of callout.childNodes) {
    if (
      child.nodeType === 1 &&
      (child as Element).classList.contains("callout-title")
    ) {
      continue;
    }

    if (child.textContent?.trim()) {
      return true;
    }
  }

  return false;
}

function clearCalloutDecoration(callout: HTMLElement): void {
  const wasDecorated = callout.classList.contains("cc-divider-callout");

  for (const name of DIVIDER_CALLOUT_CLASSES) {
    if (callout.classList.contains(name)) callout.classList.remove(name);
  }

  if (wasDecorated) {
    const original = originalAccessibility.get(callout);
    for (const [name, value] of [["role", original?.role], ["aria-orientation", original?.orientation]]) {
      if (value == null) callout.removeAttribute(name!);
      else callout.setAttribute(name!, value);
    }
    originalAccessibility.delete(callout);
  }
}

function resolveStyle(
  callout: HTMLElement,
  settings: CrispCraftSettings,
): DividerStyle {
  const metadata = callout.dataset.calloutMetadata?.trim().toLowerCase();

  if (metadata && DIVIDER_STYLES.has(metadata as DividerStyle)) {
    return metadata as DividerStyle;
  }

  return settings.divider.defaultStyle;
}

export function clearDividerDecorations(el: HTMLElement): void {
  for (const target of getDecoratorTargets(el)) {
    if (target.tagName === "HR") {
      if (target.classList.contains("cc-divider")) target.classList.remove("cc-divider");
    } else {
      clearCalloutDecoration(target);
    }
  }
}

export function decorateDividers(
  el: HTMLElement,
  settings: CrispCraftSettings,
): void {
  if (!settings.divider.enabled) {
    clearDividerDecorations(el);
    return;
  }

  for (const target of getDecoratorTargets(el)) {
    if (target.tagName === "HR") {
      if (!target.classList.contains("cc-divider")) target.classList.add("cc-divider");
      continue;
    }

    if (!target.matches(".callout[data-callout='divider']") || hasMeaningfulContent(target)) {
      clearCalloutDecoration(target);
      continue;
    }

    const styleClass = `cc-divider-${resolveStyle(target, settings)}`;
    if (!target.classList.contains("cc-divider-callout")) originalAccessibility.set(target, {
      role: target.getAttribute("role"),
      orientation: target.getAttribute("aria-orientation"),
    });
    for (const name of DIVIDER_CALLOUT_CLASSES) {
      if (name !== "cc-divider-callout" && name !== styleClass && target.classList.contains(name)) {
        target.classList.remove(name);
      }
    }
    if (!target.classList.contains("cc-divider-callout")) target.classList.add("cc-divider-callout");
    if (!target.classList.contains(styleClass)) target.classList.add(styleClass);
    if (target.getAttribute("role") !== "separator") target.setAttribute("role", "separator");
    if (target.getAttribute("aria-orientation") !== "horizontal") target.setAttribute("aria-orientation", "horizontal");
  }
}
