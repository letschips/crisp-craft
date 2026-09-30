import { MarkdownView, Plugin } from "obsidian";
import {
  CrispCraftSettingTab,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type CrispCraftSettings,
} from "./settings";
import { clearAttachmentDecorations } from "./attachment";
import { clearDividerDecorations } from "./divider";
import {
  cancelPendingSections,
  processRenderedSection,
  refreshProcessedSections,
  trackRenderedSection,
} from "./post-process";
import {
  applyAllRootStates,
  clearRootState,
  refreshAllReadingRoots,
} from "./root-state";

export default class CrispCraftPlugin extends Plugin {
  settings: CrispCraftSettings = normalizeSettings(DEFAULT_SETTINGS);

  async onload(): Promise<void> {
    const raw = await this.loadData();
    this.settings = normalizeSettings(raw ?? {});

    this.registerMarkdownPostProcessor((el, ctx) => {
      trackRenderedSection(el, ctx);
      processRenderedSection(el, this.settings);
    });

    const refreshRoots = (): void => {
      applyAllRootStates(this.app, this.settings);
    };
    this.registerEvent(this.app.workspace.on("layout-change", refreshRoots));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", refreshRoots),
    );
    this.addSettingTab(new CrispCraftSettingTab(this.app, this));
    this.addCommand({
      id: "toggle-reading-view-enhancement",
      name: "Toggle Reading View enhancement",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
      },
    });
    // Clear markers left by an older build, including mounted editor embeds.
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView) {
        clearAttachmentDecorations(leaf.view.containerEl);
        clearDividerDecorations(leaf.view.containerEl);
        // Prime section lifetimes for the renderer cache inherited on reload.
        if (leaf.view.getMode() === "preview") leaf.view.previewMode.rerender(true);
      }
    }
    // Notes already open before the plugin loaded have undecorated sections.
    refreshAllReadingRoots(this.app, this.settings);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshReadingViews();
  }

  protected refreshReadingViews(): void {
    refreshProcessedSections(this.settings);
    refreshAllReadingRoots(this.app, this.settings);
  }

  onunload(): void {
    cancelPendingSections();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;

      const containerEl = view.containerEl;
      if (!containerEl) continue;
      clearAttachmentDecorations(containerEl);
      clearDividerDecorations(containerEl);

      for (const root of containerEl.querySelectorAll<HTMLElement>(
        ".markdown-reading-view",
      )) {
        clearRootState(root);
      }
    }
  }
}
