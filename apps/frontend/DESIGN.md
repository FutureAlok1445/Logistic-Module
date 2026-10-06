---
name: IMS Employee Workspace
description: A precise working journal in warm paper, stone and botanical ink.
colors:
  ink-navigation: "#292f2b"
  botanical-action: "#49684f"
  botanical-hover: "#36513d"
  information: "#526b88"
  stone: "#f2f0eb"
  paper: "#fffefa"
  ink-text: "#2c332d"
  muted-text: "#62685f"
  rule: "#dddcd3"
  soft-botanical: "#e9eee5"
  danger: "#a43c35"
  warning: "#805c25"
  navigation-active: "#d9e2cd"
  navigation-active-ink: "#25382c"
  navigation-text: "#e1e4d8"
  focus: "#53aee7"
typography:
  display:
    fontFamily: '"Bodoni Moda Variable", Georgia, serif'
    fontSize: "clamp(34px, 3.4vw, 48px)"
    fontWeight: 500
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  body:
    fontFamily: '"Manrope Variable", "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.65
  analysis-title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "20px"
  control:
    fontFamily: '"Manrope Variable", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  analysis-label:
    fontFamily: '"Manrope Variable", "Segoe UI", sans-serif'
    fontSize: "11px"
  status-label:
    fontFamily: '"Manrope Variable", "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 600
rounded:
  status: "5px"
  control: "7px"
  surface: "12px"
spacing:
  compact: "10px"
  control-horizontal: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.botanical-action}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.botanical-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-item:
    textColor: "{colors.navigation-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-item-active:
    backgroundColor: "{colors.navigation-active}"
    textColor: "{colors.navigation-active-ink}"
  status-chip:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.muted-text}"
    typography: "{typography.status-label}"
    rounded: "{rounded.status}"
    padding: "4px 8px"
  surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.surface}"
---

# Design System: IMS Employee Workspace

## Overview

**Creative North Star: "The Employee's Working Journal"**

Warm paper, stone surroundings and ink navigation give the workspace a calm editorial character. The user approved a luxury editorial / wabi-sabi direction implemented directly in code. Material restraint comes from colour, typography and thin rules; decorative imperfection never changes alignment, contrast or data precision.

The operating system remains worksheet-first. Compact, comparable records take priority over decoration. Spacious serif page titles orient employees; sans-serif controls, labelled status and real record comparisons support their work. Smooth motion introduces changes without taking over native scrolling.

**Key Characteristics:**
- Warm paper surfaces against stone surroundings and ink navigation.
- Self-hosted editorial headings with practical sans-serif data and controls.
- Dense worksheets, visible exceptions and aligned numerical comparisons.
- Brief state transitions, collapsible navigation and optional quiet scrollbars.

### Direction contract

THESIS: An employee's working journal, precise enough for warehouse decisions and calm enough for a full workday.

OWN-WORLD: Paper #fffefa, stone #f2f0eb, ink #292f2b, botanical action #49684f. Bodoni headings, Manrope controls, restrained borders and aligned numerals.

STORY: Review source records, combine conditions, compare distributions, inspect fields, then export or coordinate with colleagues.

FIRST VIEWPORT: Ink navigation beside a paper header; an editorial page title precedes practical workbook controls. The selected worksheet and its analysis remain the main content. Primary actions stay immediately visible.

FORM: User-pinned editorial/wabi-sabi operating journal, built directly in code. Dense tables preserve familiar Excel conventions.

MOTION: A single sheet-opening route transition; smooth navigation collapse, chart updates and transient panel entrance. Reduced-motion disables these effects. Scrolling remains native even when its bars are hidden.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

The retained first-viewport contract describes the Excel surface, rather than imposing its composition on every route. No shipping raster was introduced by this documentation pass.

## Colors

The palette combines warm neutrals with a muted botanical action colour. Frontmatter owns token values.

### Primary
- **Botanical Action:** primary buttons, selected worksheet controls, chart marks and active input borders. Its deeper hover tone indicates interaction.

### Secondary
- **Information:** informational communication distinct from action and exception states.

### Neutral
- **Paper / Stone:** work surfaces and their surrounding canvas.
- **Ink Navigation / Ink Text:** persistent navigation and readable record content.
- **Muted Text / Rule:** supporting copy, table divisions and restrained boundaries.
- **Soft Botanical:** low-emphasis hover and selected supporting surfaces.

Danger and warning remain explicitly labelled semantic states. Existing delivery/payment badges retain their green, blue, amber and red meanings; the editorial palette does not redefine those meanings.

**The Labelled State Rule.** Colour supports a readable status or control label; it never carries the operational meaning alone.

## Typography

**Display Font:** self-hosted Bodoni Moda Variable, with Georgia and serif fallbacks.
**Body Font:** self-hosted Manrope Variable, with Segoe UI and sans-serif fallbacks.

The root layout imports both variable font packages. Bodoni supplies the editorial page-title character; Manrope keeps controls, records, chart controls and analysis headings practical.

### Hierarchy
- **Display:** page titles use the frontmatter display role; at the compact breakpoint they become 36px. The 29px brand and inbox headings share the serif family.
- **Analysis Title:** sans-serif (20px) with supporting copy (12px); drawer, profile and team section headings also remain sans-serif.
- **Body:** the 13px base carries relaxed line height. Page introductions stay within 68ch and use line height 1.7.
- **Control:** 13px semibold labels and buttons; analytics field labels use 11px.
- **Status Label:** compact 10px semibold badges, always with readable text.

**The Precision Rule.** Tables and recurring numerical comparisons use tabular numerals. Editorial type belongs in orientation and headings, never in dense numeric cells.

## Layout

Persistent desktop navigation is 238px wide and collapses to a 76px icon rail. Links retain titles and accessible current-page state. Collapse and optional hidden-scrollbar preferences persist locally; hidden bars do not remove native wheel, touch or keyboard scrolling.

Work surfaces use thin boundaries, dense tables and practical command bars. The selected worksheet stays primary, with analysis beside it on wide layouts and stacked on narrow layouts. The expanded analytics workbench uses a four-column control grid and a horizontally scrollable process row; charts provide a corresponding data-table disclosure.

At 900px and below, desktop rail collapse is replaced by mobile navigation behaviour and analysis controls become two columns. At 640px and below, main content uses 24px by 14px padding, workbench padding becomes 18px by 12px, filter conditions reflow, segmented controls can scroll, and the notification panel becomes a fixed inset surface. Preserve horizontal table scrolling rather than shrinking every column to fit.

## Elevation & Depth

Persistent panels are flat at rest, separated by stone surroundings and thin rules. Depth is reserved for transient overlays: the notification inbox uses a diffuse shadow and dialogs use a translucent, blurred backdrop. Do not add a shadow to every worksheet or record container.

**The Transient Depth Rule.** Lift an overlay when it temporarily sits above work; keep ordinary operating surfaces flat.

## Shapes

Controls and navigation links use gently curved corners (7px); panels and transient inbox surfaces use a broader curve (12px). Compact status chips use 5px. Thin borders define fields and records. The material character does not introduce distressed edges or misaligned data.

## Components

### Buttons and fields

Primary buttons use botanical fill and paper text; secondary buttons use paper, ink and a rule border. Both inherit 10px by 16px padding and a 42px minimum height. Fields use paper, a rule border, 7px corners, 10px by 12px padding and a 42px minimum height. Focus remains a visible 3px blue outline with offset; field borders also shift to botanical. Hover treatment is tonal, and active buttons shift down 1px. Disabled controls reduce opacity and show an unavailable cursor.

### Navigation

Ink navigation contains pale links with a soft botanical selected surface and contrasting dark selected text. The expanded brand uses Bodoni; the collapsed rail keeps existing SVG icons and link titles. Mobile navigation exposes labelled open/close controls and Escape dismissal. Keep role-based visibility intact.

### Worksheets and analytics

Sheet tabs, filter bars, headers and quality controls preserve the familiar worksheet structure. Numeric cells stay aligned. Analytics charts use botanical marks, thin rule-coloured grids and selectable chart/field controls, with an optional tabular representation. Filtered-record counts and empty-chart explanations remain visible; charts must come from records rather than decorative example values.

### Notifications and recovery

The notification trigger uses a compact count badge. Its panel has a serif heading, labelled actions, bounded native scrolling and links back to relevant work. Recovery screens pair a clear serif title with explanatory copy and practical return/retry actions. Loading surfaces use a restrained skeleton pulse rather than pretending records have loaded.

### Motion

Controls transition colour, border and shadow over 180ms; navigation width and position change over 360ms. Shared easing is cubic-bezier(0.22, 1, 0.36, 1). A route opens over 320ms with a short vertical shift; dialogs open over 260ms and the inbox over 220ms. Chart updates use 500ms only when the user's motion preference permits them. Reduced-motion removes CSS transitions, animations and smooth scroll behaviour, and chart animation respects that preference separately. Native scrolling is never replaced by a scripted scroll engine.

Employee status remains manual availability plus recent activity, never attendance. Workbook analysis remains separate from authoritative ingestion; visual refinements must preserve source ownership, role permissions and explicit exceptions.

## Do's and Don'ts

### Do:
- **Do** use paper and stone surfaces with botanical actions and ink navigation.
- **Do** reserve Bodoni for orientation and keep Manrope in dense records and controls.
- **Do** retain labelled status, tabular numerals, visible focus and native scrolling.
- **Do** make chart data inspectable and retain worksheet-first operation.
- **Do** honour reduced-motion and retain accessible labels when navigation collapses.

### Don't:
- **Don't** turn material imperfection into misaligned cells or reduced legibility.
- **Don't** add promotional heroes or fictional KPIs to employee work surfaces.
- **Don't** use availability as attendance or analysis as an authoritative financial edit.
- **Don't** introduce persistent surface shadows or decorative motion unrelated to state changes.
