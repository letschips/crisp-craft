import { vi } from "vitest";

export class Plugin {
  app: unknown;
  loadData = vi.fn(async (): Promise<unknown> => null);
  saveData = vi.fn(async (_data: unknown): Promise<void> => {});
  registerEvent = vi.fn();
  registerMarkdownPostProcessor = vi.fn((_processor: unknown) => ({}));
  commands: unknown[] = [];
  settingTabs: PluginSettingTab[] = [];

  constructor(app?: unknown, _manifest?: unknown) {
    this.app = app;
  }

  addCommand(command: unknown): unknown {
    this.commands.push(command);
    return command;
  }

  addSettingTab(tab: PluginSettingTab): void {
    this.settingTabs.push(tab);
  }
}

export class MarkdownRenderChild {
  constructor(public containerEl: HTMLElement) {}

  onload(): void {}

  onunload(): void {}
}

export class MarkdownView {
  containerEl = document.createElement("div");
  previewMode = {
    rerender: vi.fn(),
  };

  private mode: "source" | "preview" = "preview";

  getMode(): "source" | "preview" {
    return this.mode;
  }
}

export class PluginSettingTab {
  app: unknown;
  containerEl: HTMLElement;

  constructor(app: unknown, _plugin: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }

  display(): void {}
}

export class ValueComponent<T> {
  disabled = false;
  private changeHandlers: Array<(value: T) => unknown> = [];
  private value: T;

  constructor(
    public containerEl: HTMLElement,
    value: T,
  ) {
    this.value = value;
  }

  setValue(value: T): this {
    this.value = value;
    return this;
  }

  getValue(): T {
    return this.value;
  }

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }

  onChange(callback: (value: T) => unknown): this {
    this.changeHandlers.push(callback);
    return this;
  }

  async emitChange(value: T): Promise<void> {
    this.value = value;
    for (const handler of this.changeHandlers) {
      await handler(value);
    }
  }
}

export class ToggleComponent extends ValueComponent<boolean> {
  constructor(containerEl: HTMLElement) {
    super(containerEl, false);
  }
}

export class DropdownComponent extends ValueComponent<string> {
  options: Array<{ value: string; label: string }> = [];

  constructor(containerEl: HTMLElement) {
    super(containerEl, "");
  }

  addOption(value: string, label: string): this {
    this.options.push({ value, label });
    return this;
  }
}

export class ColorComponent extends ValueComponent<string> {
  constructor(containerEl: HTMLElement) {
    super(containerEl, "");
  }
}

export class Setting {
  static instances: Setting[] = [];

  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  components: Array<ValueComponent<unknown>> = [];
  disabled = false;

  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.infoEl = document.createElement("div");
    this.nameEl = document.createElement("div");
    this.descEl = document.createElement("div");
    this.controlEl = document.createElement("div");
    this.infoEl.append(this.nameEl, this.descEl);
    this.settingEl.append(this.infoEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
    Setting.instances.push(this);
  }

  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(desc: string): this {
    this.descEl.textContent = desc;
    return this;
  }

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }

  setHeading(): this {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }

  addToggle(callback: (component: ToggleComponent) => unknown): this {
    const component = new ToggleComponent(this.controlEl);
    this.components.push(component as ValueComponent<unknown>);
    callback(component);
    return this;
  }

  addDropdown(callback: (component: DropdownComponent) => unknown): this {
    const component = new DropdownComponent(this.controlEl);
    this.components.push(component as ValueComponent<unknown>);
    callback(component);
    return this;
  }

  addColorPicker(callback: (component: ColorComponent) => unknown): this {
    const component = new ColorComponent(this.controlEl);
    this.components.push(component as ValueComponent<unknown>);
    callback(component);
    return this;
  }
}
