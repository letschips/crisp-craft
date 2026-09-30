# Crisp Craft

> Craft-inspired Reading View polish for Obsidian, designed for transparent and glass workflows.

Part of the **Crisp Series** for Obsidian by [letschips](https://github.com/letschips).

---

## 🎨 Overview

**Crisp Craft** is an independent Obsidian plugin that enhances **Reading View only** with a polished, editorial, Craft-inspired visual language while seamlessly preserving the Crisp ecosystem's transparent / Liquid Glass identity.

### Core Philosophy: *Editing stays clean; reading becomes finished.*

The plugin is not a theme and does **not** introduce an opaque page background, paper layer, or full-screen backdrop. Its sole job is to refine document components:
- **Dividers**: Six decorative separator styles.
- **Headings**: Editorial hierarchy with restrained accent markers.
- **Quotes & Callouts**: Glass-edged translucent styling while retaining full callout mechanics.
- **Images**: Subtle frames, glass edges, and configurable corner rounding.
- **File Attachments**: Clean, compact file cards for PDFs, office documents, archives, audio, and video.
- **Tables**: Soft borders, gentle header tint, and contained horizontal scrolling for wide tables.

---

## 🛡️ Product Boundaries & Principles

Crisp Craft strictly adheres to the following principles:

1. **Reading View Only**: Never touches or styles Source Mode or Live Preview (`.cm-*`, `.markdown-source-view`).
2. **No Background Replacement**: Transparent, translucent, and glass workflows remain uncompromised.
3. **No Content Mutation**: Never modifies your Markdown source or injects persistent HTML into notes.
4. **100% Local & Offline**: Zero network calls, zero telemetry, zero analytics, zero external web fonts.
5. **Clean Unload**: Disabling or uninstalling immediately returns notes to default Obsidian rendering with zero lingering DOM artifacts.
6. **Independent**: Functions completely standalone without requiring any other Crisp plugin.
7. **Original Visual Assets**: All separator patterns and CSS masks are original assets; not copied or extracted from Craft Docs.

---

## ✨ Component System

### 1. Dividers

Standard Markdown horizontal rules (`---`) automatically render using your configured default divider style:

```markdown
---
```

For explicit style selection per section, use Obsidian callout metadata:

```markdown
> [!divider|wave]

> [!divider|minimal]

> [!divider|dots]

> [!divider|brush]

> [!divider|tape]

> [!divider|glass]
```

- `wave`: Continuous wave ribbon pattern via token-tinted SVG mask.
- `minimal`: Subtle center line with gracefully faded ends.
- `dots`: Restrained repeating dot sequence.
- `brush`: Soft irregular artistic brush stroke mask.
- `tape`: Translucent textured strip with softened edges.
- `glass`: Fine translucent pill with subtle border highlight.

*Divider callouts automatically expose `role="separator"` and `aria-orientation="horizontal"` for screen readers.*

### 2. Headings

- **Editorial** (Default): Refined spacing and typographic balance; H2 features a short accent marker, H3 features a subtle secondary mark.
- **Clean**: Spacing and weight enhancements only, without decorative markers.
- **Marker**: More prominent section indicator while staying translucent.

*Crisp Craft preserves your configured theme font family and never alters H5/H6.*

### 3. Quotes & Callouts

- **Glass Edge** (Default): Translucent surface with a fine accent edge for blockquotes. Callouts keep the theme's type colours (note, warning, danger…) and only gain Craft's rounded shape and inner highlight.
  Backdrop blur is disabled for Craft glass components in Obsidian's translucent window mode to avoid scroll artifacts; other environments use it when supported.
- **Edge**: Transparent background with an accent edge rule and typographic polish.
- **Minimal**: Typography and line spacing refinement only.

*Native callout icons, folding behavior, titles, and third-party callout semantics are strictly preserved.*

### 4. Images

- **Subtle** (Default): Gentle corner radius, hair-thin border highlight, and soft shadow.
- **Glass**: Low-alpha glass edge and translucent perimeter.
- **None**: Native frame with refined margins.

*Explicit image dimensions (`|300x200`) and embed behaviors are fully preserved.*

### 5. File Attachments

Internal links to attachments (PDF, ZIP, DOCX, XLSX, PPTX, CSV, JSON, TXT, audio, video) are classified into elegant card affordances:

- **Compact** (Default): Streamlined card with uppercase file extension badge.
- **Soft**: Slightly more generous padding with a gentle glass border.

*Native Obsidian click, preview, and keyboard navigation handlers are never intercepted.*

### 6. Tables

- Transparent background compatible with light, dark, and translucent themes.
- Subtle header tint for visual hierarchy.
- Soft cell dividers and refined cell padding.
- Horizontal scrolling stays inside the document area when a table exceeds the available width.

---

## 🎨 Token Integration & Theming

Crisp Craft establishes a three-tier token resolution hierarchy:

```text
Crisp Ecosystem Token (--cs-accent-primary)
  ↳ Native Obsidian Token (--interactive-accent, --text-normal, --background-modifier-border)
      ↳ Built-in Literal Fallback
```

- Adapts automatically to Light and Dark modes.
- Visual Intensity can be toggled between `Subtle`, `Balanced` (default), and `Rich`.
- Custom accent colors can be configured independently for divider styling.

---

## ⚙️ Settings

Open **Settings → Crisp Craft**. The panel is localised in Chinese; the labels it renders are given in parentheses below.

- **Global** (全局): Toggle plugin enablement, adjust visual intensity (`轻柔` / `均衡` / `浓郁`).
- **Divider** (分隔线): Enable/disable, choose default style (`波纹` / `极简` / `圆点` / `笔刷` / `胶带` / `玻璃`), select accent source (`Crisp` / `Obsidian` / `自定义`), and pick custom accent colors.
- **Heading** (标题): Enable/disable, select style (`编辑风` / `简洁` / `标记`).
- **Quote / Callout** (引用 / Callout): Enable/disable, select style (`玻璃边` / `边线` / `极简`).
- **Image** (图片): Enable/disable, toggle rounded corners, select frame style (`无` / `细腻` / `玻璃`).
- **Attachment** (附件): Enable/disable, select card style (`紧凑` / `柔和`).
- **Table** (表格): Toggle enhanced table styling.

*All settings changes update already-open Reading View tabs immediately without requiring an app reload.*

---

## ⌨️ Command Palette

- `Crisp Craft: Toggle Reading View enhancement`: Quickly toggle the entire plugin on or off.

---

## 📦 Installation

Crisp Craft is free and needs no activation code.

**BRAT (recommended until it is listed in Community plugins)**

1. Install and enable [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Run **BRAT: Add a beta plugin for testing** and enter `letschips/crisp-craft`.
3. Enable **Crisp Craft** in **Settings → Community plugins**.

**Manual**

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/letschips/crisp-craft/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/crisp-craft/`.
3. Reload plugins in **Settings → Community plugins** and enable **Crisp Craft**.

---

## ⚖️ Disclaimer

Crisp Craft is an independent Obsidian plugin created by letschips. It is **not** affiliated with, endorsed by, or associated with Craft Docs (Luki Labs Ltd.). All visual motifs and code implementations are entirely original.

---

## 📄 License

[MIT](LICENSE) © 2026 [letschips](https://github.com/letschips).
