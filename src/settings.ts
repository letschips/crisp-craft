import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";

export type VisualIntensity = "subtle" | "balanced" | "rich";
export type DividerStyle =
  | "wave"
  | "minimal"
  | "dots"
  | "brush"
  | "tape"
  | "glass";
export type AccentSource = "crisp" | "obsidian" | "custom";
export type HeadingStyle = "editorial" | "clean" | "marker";
export type QuoteStyle = "glass-edge" | "edge" | "minimal";
export type ImageFrame = "none" | "subtle" | "glass";
export type AttachmentStyle = "compact" | "soft";

export interface CrispCraftSettings {
  schemaVersion: 1;
  enabled: boolean;
  intensity: VisualIntensity;
  divider: {
    enabled: boolean;
    defaultStyle: DividerStyle;
    accentSource: AccentSource;
    customAccent: string;
  };
  heading: { enabled: boolean; style: HeadingStyle };
  quote: { enabled: boolean; style: QuoteStyle };
  image: { enabled: boolean; rounded: boolean; frame: ImageFrame };
  attachment: { enabled: boolean; style: AttachmentStyle };
  table: { enabled: boolean };
}

export const DEFAULT_SETTINGS: CrispCraftSettings = {
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
};

type DataRecord = Record<string, unknown>;

function asRecord(value: unknown): DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DataRecord)
    : {};
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function enumOr<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function colorOr(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const color = value.trim();
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return fallback;

  if (color.length === 4) {
    return `#${color
      .slice(1)
      .split("")
      .map((digit) => digit.repeat(2))
      .join("")}`.toUpperCase();
  }

  return color.toUpperCase();
}

export function normalizeSettings(raw: unknown): CrispCraftSettings {
  const data = asRecord(raw);
  const divider = asRecord(data.divider);
  const heading = asRecord(data.heading);
  const quote = asRecord(data.quote);
  const image = asRecord(data.image);
  const attachment = asRecord(data.attachment);
  const table = asRecord(data.table);

  return {
    schemaVersion: 1,
    enabled: booleanOr(data.enabled, DEFAULT_SETTINGS.enabled),
    intensity: enumOr(
      data.intensity,
      ["subtle", "balanced", "rich"],
      DEFAULT_SETTINGS.intensity,
    ),
    divider: {
      enabled: booleanOr(divider.enabled, DEFAULT_SETTINGS.divider.enabled),
      defaultStyle: enumOr(
        divider.defaultStyle,
        ["wave", "minimal", "dots", "brush", "tape", "glass"],
        DEFAULT_SETTINGS.divider.defaultStyle,
      ),
      accentSource: enumOr(
        divider.accentSource,
        ["crisp", "obsidian", "custom"],
        DEFAULT_SETTINGS.divider.accentSource,
      ),
      customAccent: colorOr(
        divider.customAccent,
        DEFAULT_SETTINGS.divider.customAccent,
      ),
    },
    heading: {
      enabled: booleanOr(heading.enabled, DEFAULT_SETTINGS.heading.enabled),
      style: enumOr(
        heading.style,
        ["editorial", "clean", "marker"],
        DEFAULT_SETTINGS.heading.style,
      ),
    },
    quote: {
      enabled: booleanOr(quote.enabled, DEFAULT_SETTINGS.quote.enabled),
      style: enumOr(
        quote.style,
        ["glass-edge", "edge", "minimal"],
        DEFAULT_SETTINGS.quote.style,
      ),
    },
    image: {
      enabled: booleanOr(image.enabled, DEFAULT_SETTINGS.image.enabled),
      rounded: booleanOr(image.rounded, DEFAULT_SETTINGS.image.rounded),
      frame: enumOr(
        image.frame,
        ["none", "subtle", "glass"],
        DEFAULT_SETTINGS.image.frame,
      ),
    },
    attachment: {
      enabled: booleanOr(
        attachment.enabled,
        DEFAULT_SETTINGS.attachment.enabled,
      ),
      style: enumOr(
        attachment.style,
        ["compact", "soft"],
        DEFAULT_SETTINGS.attachment.style,
      ),
    },
    table: {
      enabled: booleanOr(table.enabled, DEFAULT_SETTINGS.table.enabled),
    },
  };
}

interface CrispCraftSettingsHost extends Plugin {
  settings: CrispCraftSettings;
  saveSettings(): Promise<void>;
}

type SettingOption<T extends string> = readonly [value: T, label: string];

function addGroupHeading(containerEl: HTMLElement, title: string): void {
  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.className = "crisp-craft-settings-heading";
  containerEl.appendChild(heading);
}

function addToggleSetting(
  containerEl: HTMLElement,
  name: string,
  value: boolean,
  onChange: (value: boolean) => void,
): Setting {
  return new Setting(containerEl).setName(name).addToggle((toggle) => {
    toggle.setValue(value).onChange(onChange);
  });
}

function addDropdownSetting<T extends string>(
  containerEl: HTMLElement,
  name: string,
  value: T,
  options: readonly SettingOption<T>[],
  onChange: (value: T) => void,
): Setting {
  return new Setting(containerEl).setName(name).addDropdown((dropdown) => {
    for (const [optionValue, label] of options) {
      dropdown.addOption(optionValue, label);
    }
    dropdown.setValue(value).onChange((nextValue) => onChange(nextValue as T));
  });
}

export class CrispCraftSettingTab extends PluginSettingTab {
  private readonly plugin: CrispCraftSettingsHost;
  private customAccentSetting: Setting | null = null;

  constructor(app: App, plugin: CrispCraftSettingsHost) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.replaceChildren();
    this.customAccentSetting = null;

    this.displayGlobal();
    this.displayDivider();
    this.displayHeading();
    this.displayQuote();
    this.displayImage();
    this.displayAttachment();
    this.displayTable();
    this.updateCustomAccentVisibility();
  }

  private async save(update: () => void): Promise<void> {
    update();
    await this.plugin.saveSettings();
  }

  private displayGlobal(): void {
    addGroupHeading(this.containerEl, "全局");
    addToggleSetting(
      this.containerEl,
      "启用 Crisp Craft",
      this.plugin.settings.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.enabled = enabled;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "视觉强度",
      this.plugin.settings.intensity,
      [
        ["subtle", "轻柔"],
        ["balanced", "均衡"],
        ["rich", "浓郁"],
      ],
      async (intensity) => {
        await this.save(() => {
          this.plugin.settings.intensity = intensity;
        });
      },
    );
  }

  private displayDivider(): void {
    addGroupHeading(this.containerEl, "分隔线");
    addToggleSetting(
      this.containerEl,
      "启用分隔线",
      this.plugin.settings.divider.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.divider.enabled = enabled;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "默认样式",
      this.plugin.settings.divider.defaultStyle,
      [
        ["wave", "波纹"],
        ["minimal", "极简"],
        ["dots", "圆点"],
        ["brush", "笔刷"],
        ["tape", "胶带"],
        ["glass", "玻璃"],
      ],
      async (defaultStyle) => {
        await this.save(() => {
          this.plugin.settings.divider.defaultStyle = defaultStyle;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "强调色来源",
      this.plugin.settings.divider.accentSource,
      [
        ["crisp", "Crisp"],
        ["obsidian", "Obsidian"],
        ["custom", "自定义"],
      ],
      async (accentSource) => {
        await this.save(() => {
          this.plugin.settings.divider.accentSource = accentSource;
        });
        this.updateCustomAccentVisibility();
      },
    );
    this.customAccentSetting = new Setting(this.containerEl)
      .setName("自定义强调色")
      .addColorPicker((picker) => {
        picker
          .setValue(this.plugin.settings.divider.customAccent)
          .onChange(async (customAccent) => {
            await this.save(() => {
              this.plugin.settings.divider.customAccent = customAccent;
            });
          });
      });
  }

  private displayHeading(): void {
    addGroupHeading(this.containerEl, "标题");
    addToggleSetting(
      this.containerEl,
      "启用标题修饰",
      this.plugin.settings.heading.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.heading.enabled = enabled;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "标题样式",
      this.plugin.settings.heading.style,
      [
        ["editorial", "编辑风"],
        ["clean", "简洁"],
        ["marker", "标记"],
      ],
      async (style) => {
        await this.save(() => {
          this.plugin.settings.heading.style = style;
        });
      },
    );
  }

  private displayQuote(): void {
    addGroupHeading(this.containerEl, "引用 / Callout");
    addToggleSetting(
      this.containerEl,
      "启用引用 / Callout",
      this.plugin.settings.quote.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.quote.enabled = enabled;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "引用 / Callout 样式",
      this.plugin.settings.quote.style,
      [
        ["glass-edge", "玻璃边"],
        ["edge", "边线"],
        ["minimal", "极简"],
      ],
      async (style) => {
        await this.save(() => {
          this.plugin.settings.quote.style = style;
        });
      },
    );
  }

  private displayImage(): void {
    addGroupHeading(this.containerEl, "图片");
    addToggleSetting(
      this.containerEl,
      "启用图片修饰",
      this.plugin.settings.image.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.image.enabled = enabled;
        });
      },
    );
    addToggleSetting(
      this.containerEl,
      "圆角",
      this.plugin.settings.image.rounded,
      async (rounded) => {
        await this.save(() => {
          this.plugin.settings.image.rounded = rounded;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "图片边框",
      this.plugin.settings.image.frame,
      [
        ["none", "无"],
        ["subtle", "细腻"],
        ["glass", "玻璃"],
      ],
      async (frame) => {
        await this.save(() => {
          this.plugin.settings.image.frame = frame;
        });
      },
    );
  }

  private displayAttachment(): void {
    addGroupHeading(this.containerEl, "附件");
    addToggleSetting(
      this.containerEl,
      "启用附件卡片",
      this.plugin.settings.attachment.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.attachment.enabled = enabled;
        });
      },
    );
    addDropdownSetting(
      this.containerEl,
      "附件卡片样式",
      this.plugin.settings.attachment.style,
      [
        ["compact", "紧凑"],
        ["soft", "柔和"],
      ],
      async (style) => {
        await this.save(() => {
          this.plugin.settings.attachment.style = style;
        });
      },
    );
  }

  private displayTable(): void {
    addGroupHeading(this.containerEl, "表格");
    addToggleSetting(
      this.containerEl,
      "增强表格样式",
      this.plugin.settings.table.enabled,
      async (enabled) => {
        await this.save(() => {
          this.plugin.settings.table.enabled = enabled;
        });
      },
    );
  }

  private updateCustomAccentVisibility(): void {
    if (!this.customAccentSetting) return;

    const visible = this.plugin.settings.divider.accentSource === "custom";
    this.customAccentSetting.setDisabled(!visible);
    this.customAccentSetting.settingEl.hidden = !visible;
  }
}
