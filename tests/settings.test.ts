import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ColorComponent,
  DropdownComponent,
  MarkdownView,
  Setting,
  ToggleComponent,
} from "./obsidian-mock";
import {
  CrispCraftSettingTab,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type CrispCraftSettings,
} from "../src/settings";
import CrispCraftPlugin from "../src/main";

function createPlugin(views: MarkdownView[] = []): CrispCraftPlugin {
  const leaves = views.map((view) => ({ view }));
  const app = {
    workspace: {
      getLeavesOfType: vi.fn(() => leaves),
      on: vi.fn(() => ({})),
    },
  };
  return new CrispCraftPlugin(app as never, {} as never);
}

function createView(mode: "source" | "preview"): MarkdownView {
  const view = new MarkdownView();
  vi.spyOn(view, "getMode").mockReturnValue(mode);
  return view;
}

// Runs the plugin's registered post-processor on a section mounted in the
// view's Reading View root, as Obsidian does for a rendered note.
function renderSection(
  plugin: CrispCraftPlugin,
  view: MarkdownView,
  html: string,
): HTMLElement {
  let root = view.containerEl.querySelector<HTMLElement>(".markdown-reading-view");
  if (!root) {
    root = document.createElement("div");
    root.className = "markdown-reading-view";
    view.containerEl.appendChild(root);
  }
  const section = document.createElement("div");
  section.className = "markdown-preview-section";
  section.innerHTML = html;
  root.appendChild(section);
  const processor = vi.mocked(plugin.registerMarkdownPostProcessor).mock
    .calls[0][0] as (el: HTMLElement, ctx: unknown) => void;
  processor(section, { addChild: vi.fn() });
  return section;
}

describe("settings normalization", () => {
  it("defines the exact V1 defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      schemaVersion: 1,
      enabled: true,
      intensity: "balanced",
      divider: {
        enabled: true,
        defaultStyle: "wave",
        accentSource: "crisp",
        customAccent: "#5B8CFF",
      },
      heading: { enabled: true, style: "editorial" },
      quote: { enabled: true, style: "glass-edge" },
      image: { enabled: true, rounded: true, frame: "subtle" },
      attachment: { enabled: true, style: "compact" },
      table: { enabled: true },
    });
  });

  it("returns complete defaults from empty data", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("deep merges partial stored data", () => {
    const result = normalizeSettings({ divider: { defaultStyle: "dots" } });

    expect(result.divider.defaultStyle).toBe("dots");
    expect(result.divider.enabled).toBe(true);
    expect(result.image.frame).toBe("subtle");
  });

  it("falls back from invalid enum values", () => {
    const result = normalizeSettings({
      intensity: "neon",
      divider: { defaultStyle: "zigzag" },
    });

    expect(result.intensity).toBe("balanced");
    expect(result.divider.defaultStyle).toBe("wave");
  });

  it("rejects invalid top-level and nested value types", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);

    const result = normalizeSettings({
      enabled: "yes",
      schemaVersion: 99,
      divider: "wave",
      heading: null,
      image: { enabled: 1, rounded: "true", frame: [] },
      table: { enabled: "false" },
    });

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes every nested setting independently", () => {
    const result = normalizeSettings({
      enabled: false,
      intensity: "rich",
      divider: {
        enabled: false,
        defaultStyle: "glass",
        accentSource: "custom",
        customAccent: "#abc",
      },
      heading: { enabled: false, style: "marker" },
      quote: { enabled: false, style: "edge" },
      image: { enabled: false, rounded: false, frame: "none" },
      attachment: { enabled: false, style: "soft" },
      table: { enabled: false },
    });

    expect(result).toEqual({
      schemaVersion: 1,
      enabled: false,
      intensity: "rich",
      divider: {
        enabled: false,
        defaultStyle: "glass",
        accentSource: "custom",
        customAccent: "#AABBCC",
      },
      heading: { enabled: false, style: "marker" },
      quote: { enabled: false, style: "edge" },
      image: { enabled: false, rounded: false, frame: "none" },
      attachment: { enabled: false, style: "soft" },
      table: { enabled: false },
    });
  });

  it("falls back from unsafe or malformed custom colors", () => {
    expect(
      normalizeSettings({
        divider: { customAccent: "red; background: url(https://bad.invalid)" },
      }).divider.customAccent,
    ).toBe(DEFAULT_SETTINGS.divider.customAccent);
    expect(
      normalizeSettings({ divider: { customAccent: "#12xz89" } }).divider
        .customAccent,
    ).toBe(DEFAULT_SETTINGS.divider.customAccent);
    expect(
      normalizeSettings({ divider: { customAccent: 123 } }).divider.customAccent,
    ).toBe(DEFAULT_SETTINGS.divider.customAccent);
  });

  it("does not share mutable nested defaults between calls", () => {
    const first = normalizeSettings({});
    const second = normalizeSettings({});

    first.divider.defaultStyle = "dots";
    expect(second.divider.defaultStyle).toBe("wave");
    expect(DEFAULT_SETTINGS.divider.defaultStyle).toBe("wave");
  });
});

describe("settings persistence", () => {
  it("loads and normalizes stored settings", async () => {
    const plugin = createPlugin();
    vi.mocked(plugin.loadData).mockResolvedValue({
      intensity: "rich",
      divider: { defaultStyle: "dots" },
    });

    await plugin.onload();

    expect(plugin.settings.intensity).toBe("rich");
    expect(plugin.settings.divider.defaultStyle).toBe("dots");
    expect(plugin.settings.divider.enabled).toBe(true);
  });

  it("persists settings, then updates rendered sections without rerendering", async () => {
    const view = createView("preview");
    const rerender = vi.spyOn(view.previewMode, "rerender");
    const plugin = createPlugin([view]);
    await plugin.onload();
    rerender.mockClear();
    const hr = renderSection(plugin, view, "<hr>").querySelector("hr")!;
    expect(hr.classList.contains("cc-divider")).toBe(true);

    const events: string[] = [];
    vi.mocked(plugin.saveData).mockImplementation(async () => {
      events.push(`save:${hr.classList.contains("cc-divider")}`);
    });
    plugin.settings.divider.enabled = false;
    await plugin.saveSettings();
    events.push(`after:${hr.classList.contains("cc-divider")}`);

    expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    expect(events).toEqual(["save:true", "after:false"]);
    expect(rerender).not.toHaveBeenCalled();
    expect(plugin.app.workspace.getLeavesOfType).toHaveBeenCalledWith("markdown");
  });

  it("does not rerender source-mode leaves", async () => {
    const view = createView("source");
    const rerender = vi.spyOn(view.previewMode, "rerender");
    const plugin = createPlugin([view]);

    await plugin.saveSettings();

    expect(rerender).not.toHaveBeenCalled();
  });

  it("does not refresh when persistence fails", async () => {
    const view = createView("preview");
    const rerender = vi.spyOn(view.previewMode, "rerender");
    const plugin = createPlugin([view]);
    vi.mocked(plugin.saveData).mockRejectedValue(new Error("write failed"));

    await expect(plugin.saveSettings()).rejects.toThrow("write failed");
    expect(rerender).not.toHaveBeenCalled();
  });

  it("persists one nested change without dropping sibling keys", async () => {
    const plugin = createPlugin();
    plugin.settings.heading.style = "marker";

    await plugin.saveSettings();

    const saved = vi.mocked(plugin.saveData).mock.calls[0][0];
    expect(saved).toEqual({
      ...DEFAULT_SETTINGS,
      heading: { enabled: true, style: "marker" },
    });
    expect(normalizeSettings(saved)).toEqual(plugin.settings);
  });

  it("reloads persisted nested settings without losing their siblings", async () => {
    const first = createPlugin();
    first.settings.image = { enabled: true, rounded: false, frame: "glass" };
    await first.saveSettings();
    const saved = vi.mocked(first.saveData).mock.calls[0][0];

    const second = createPlugin();
    vi.mocked(second.loadData).mockResolvedValue(saved);
    await second.onload();

    expect(second.settings.image).toEqual({
      enabled: true,
      rounded: false,
      frame: "glass",
    });
    expect(second.settings.quote).toEqual(DEFAULT_SETTINGS.quote);
  });
});

describe("settings tab", () => {
  beforeEach(() => {
    Setting.instances.length = 0;
  });

  function settingNamed(name: string): Setting {
    const setting = Setting.instances.find(
      (candidate) => candidate.nameEl.textContent === name,
    );
    if (!setting) throw new Error(`Missing setting: ${name}`);
    return setting;
  }

  function componentNamed<T>(
    name: string,
    componentType: new (...args: never[]) => T,
  ): T {
    const component = settingNamed(name).components[0];
    if (!(component instanceof componentType)) {
      throw new Error(`Missing component for setting: ${name}`);
    }
    return component;
  }

  function renderTab(plugin: CrispCraftPlugin): CrispCraftSettingTab {
    const tab = new CrispCraftSettingTab(plugin.app, plugin);
    Setting.instances.length = 0;
    tab.display();
    return tab;
  }

  it("renders groups in the exact required order", () => {
    const tab = renderTab(createPlugin());

    expect(
      [...tab.containerEl.querySelectorAll("h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "全局",
      "分隔线",
      "标题",
      "引用 / Callout",
      "图片",
      "附件",
      "表格",
    ]);
  });

  it("renders the exact V1 defaults and dropdown options", () => {
    renderTab(createPlugin());

    expect(
      componentNamed("启用 Crisp Craft", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("视觉强度", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "subtle", label: "轻柔" },
        { value: "balanced", label: "均衡" },
        { value: "rich", label: "浓郁" },
      ],
      value: "balanced",
    });
    expect(
      componentNamed("启用分隔线", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("默认样式", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "wave", label: "波纹" },
        { value: "minimal", label: "极简" },
        { value: "dots", label: "圆点" },
        { value: "brush", label: "笔刷" },
        { value: "tape", label: "胶带" },
        { value: "glass", label: "玻璃" },
      ],
      value: "wave",
    });
    expect(
      componentNamed("强调色来源", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "crisp", label: "Crisp" },
        { value: "obsidian", label: "Obsidian" },
        { value: "custom", label: "自定义" },
      ],
      value: "crisp",
    });
    expect(
      componentNamed("自定义强调色", ColorComponent).getValue(),
    ).toBe("#5B8CFF");
    expect(
      componentNamed("启用标题修饰", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("标题样式", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "editorial", label: "编辑风" },
        { value: "clean", label: "简洁" },
        { value: "marker", label: "标记" },
      ],
      value: "editorial",
    });
    expect(
      componentNamed("启用引用 / Callout", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("引用 / Callout 样式", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "glass-edge", label: "玻璃边" },
        { value: "edge", label: "边线" },
        { value: "minimal", label: "极简" },
      ],
      value: "glass-edge",
    });
    expect(
      componentNamed("启用图片修饰", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("圆角", ToggleComponent).getValue(),
    ).toBe(true);
    expect(componentNamed("图片边框", DropdownComponent)).toMatchObject({
      options: [
        { value: "none", label: "无" },
        { value: "subtle", label: "细腻" },
        { value: "glass", label: "玻璃" },
      ],
      value: "subtle",
    });
    expect(
      componentNamed("启用附件卡片", ToggleComponent).getValue(),
    ).toBe(true);
    expect(
      componentNamed("附件卡片样式", DropdownComponent),
    ).toMatchObject({
      options: [
        { value: "compact", label: "紧凑" },
        { value: "soft", label: "柔和" },
      ],
      value: "compact",
    });
    expect(
      componentNamed("增强表格样式", ToggleComponent).getValue(),
    ).toBe(true);
  });

  it("hides and disables the custom color picker unless custom is selected", async () => {
    const plugin = createPlugin();
    renderTab(plugin);
    const accentSource = componentNamed(
      "强调色来源",
      DropdownComponent,
    );
    const customAccent = settingNamed("自定义强调色");

    expect(customAccent.settingEl.hidden).toBe(true);
    expect(customAccent.disabled).toBe(true);

    await accentSource.emitChange("custom");

    expect(plugin.settings.divider.accentSource).toBe("custom");
    expect(customAccent.settingEl.hidden).toBe(false);
    expect(customAccent.disabled).toBe(false);

    await accentSource.emitChange("obsidian");

    expect(customAccent.settingEl.hidden).toBe(true);
    expect(customAccent.disabled).toBe(true);
  });

  it("saves once and refreshes in place for a control change", async () => {
    const view = createView("preview");
    const rerender = vi.spyOn(view.previewMode, "rerender");
    const plugin = createPlugin([view]);
    await plugin.onload();
    rerender.mockClear();
    const root = renderSection(plugin, view, "<p>Body</p>").parentElement!;
    const saveSettings = vi.spyOn(plugin, "saveSettings");
    renderTab(plugin);
    const headingStyle = componentNamed(
      "标题样式",
      DropdownComponent,
    );

    await headingStyle.emitChange("marker");

    expect(plugin.settings.heading).toEqual({
      enabled: true,
      style: "marker",
    });
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(plugin.saveData).toHaveBeenCalledOnce();
    expect(root.dataset.ccHeadingStyle).toBe("marker");
    expect(rerender).not.toHaveBeenCalled();
  });
});

describe("settings command", () => {
  it("registers exactly one toggle command and refreshes in place when invoked", async () => {
    const view = createView("preview");
    const rerender = vi.spyOn(view.previewMode, "rerender");
    const plugin = createPlugin([view]);

    await plugin.onload();
    rerender.mockClear();
    const section = renderSection(plugin, view, "<hr>");
    const root = section.parentElement!;

    const commands = (
      plugin as unknown as {
        commands: Array<{
          id: string;
          name: string;
          callback?: () => Promise<void>;
        }>;
      }
    ).commands;
    const settingTabs = (
      plugin as unknown as {
        settingTabs: CrispCraftSettingTab[];
      }
    ).settingTabs;
    expect(settingTabs).toHaveLength(1);
    expect(settingTabs[0]).toBeInstanceOf(CrispCraftSettingTab);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      id: "toggle-reading-view-enhancement",
      name: "Toggle Reading View enhancement",
    });

    await commands[0].callback?.();

    expect(plugin.settings.enabled).toBe(false);
    expect(plugin.saveData).toHaveBeenCalledOnce();
    expect(root.classList.contains("crisp-craft-enabled")).toBe(false);
    expect(section.querySelector("hr")!.classList.contains("cc-divider")).toBe(false);
    expect(rerender).not.toHaveBeenCalled();
  });
});
