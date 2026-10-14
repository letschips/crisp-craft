# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-10-14

### Fixed
- 嵌套在引用或 callout 开头、结尾的 callout 和引用，不再在容器内边距之外再叠一层外边距（原来折叠的内层 callout 下方会多出约 1 行空白），三种引用样式都适用。
- 间距和附件标签尺寸改为跟随正文字号：原来用 `rem`，弹出窗口里根字号是 15px、正文仍是设置的字号，间距会整体偏小；iOS 上根字号还会随系统字号变化。主窗口里的数值不变。

## [0.1.3] - 2026-10-05

### Fixed
- 解决 bug：修复在阅读视图中滚动时，由于 Craft 玻璃组件（分割线、引用块、附件与图片框）的 `backdrop-filter` 导致的界面模糊、撕裂与拖拽渲染残留问题（Compositor Guard 全窗口模式生效）。

## [0.1.2] - 2026-09-30

### Fixed
- `data.json` 损坏无法读取时（例如同步冲突或写入中断），先备份为 `data.json.unreadable-<时间>` 再恢复默认设置，避免设置被静默覆盖；无法备份时本次运行不保存设置。

## [0.1.1] - 2026-09-30

First public release on GitHub, under the MIT License. Free to use, no activation code.

### Fixed
- Divider callouts and attachment chips now decorate when a note is first opened: Obsidian post-processes sections before attaching them, so decoration no longer waits for the Reading View root.
- Glass edge keeps the theme's callout type colours (warning, danger, tip…) instead of repainting every callout with the Craft accent.
- Table headers stay continuous when the theme rounds each cell; tighter cell padding stops short CJK cells in wide tables from breaking one glyph per line.
- Theme table minimum widths are reset so compact tables no longer sit in an empty full-width frame.
- Removing divider decoration restores the callout's original accessibility attributes; stale divider and attachment decoration is cleared after rendered elements change type, including inside editor embeds.

### Changed
- Settings changes update open Reading Views in place without rebuilding the note. Loading the plugin (including each Obsidian start) rerenders open Reading Views once so cached sections can be refreshed later.
- Tab switches and layout changes only sync root state instead of rescanning every open note; unchanged decoration causes no DOM writes.
- Pending frame callbacks are cancelled on unload, using each section's owning window.
- The translucent-window blur workaround is limited to active Craft glass surfaces.
- The settings panel is localised to Chinese. Dropdown option values are unchanged, so existing `data.json` files keep working.

## [0.1.0] - 2026-09-15

### Added
- Reading View-only styling framework (`.markdown-reading-view.crisp-craft-enabled`).
- Six divider presets (`wave`, `minimal`, `dots`, `brush`, `tape`, `glass`) with support for standard `---` and callout syntax `> [!divider|<style>]`.
- Heading presets (`editorial`, `clean`, `marker`) with subtle hierarchy markers and font-family preservation.
- Quote and callout styling presets (`glass-edge`, `edge`, `minimal`) while preserving native callout icons and collapse behavior.
- Image frames (`none`, `subtle`, `glass`) and configurable corner rounding while preserving user-defined dimensions.
- Local attachment cards (`compact`, `soft`) for documents, archives, audio, and video without hijacking native Obsidian link navigation.
- Enhanced transparent table styling with soft borders, gentle header tint, and mobile-safe horizontal scrolling.
- Crisp/Obsidian token fallback system (`--cs-accent-primary` -> native Obsidian tokens -> literal fallbacks) with visual intensity presets (`subtle`, `balanced`, `rich`).
- Compact settings panel with live update of open Reading View leaves without restarting Obsidian.
- Toggle command: `Crisp Craft: Toggle Reading View enhancement`.
