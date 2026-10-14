---
name: "三林老街 — Scene workbench"
description: "Scoped Unity/Timeline authoring patterns within the existing management design system."
colors:
  primary: "hsl(0 0% 9%)"
  primary-foreground: "hsl(0 0% 98%)"
  background: "hsl(0 0% 100%)"
  foreground: "hsl(0 0% 3.9%)"
  secondary: "hsl(0 0% 96.1%)"
  secondary-foreground: "hsl(0 0% 9%)"
  muted: "hsl(0 0% 96.1%)"
  muted-foreground: "hsl(0 0% 45.1%)"
  accent: "hsl(0 0% 96.1%)"
  accent-foreground: "hsl(0 0% 9%)"
  border: "hsl(0 0% 89.8%)"
  input: "hsl(0 0% 89.8%)"
  ring: "hsl(0 0% 3.9%)"
  success: "hsl(142 71% 29%)"
  warning: "hsl(26 90% 37%)"
  destructive: "hsl(0 84.2% 60.2%)"
  destructive-foreground: "hsl(0 0% 98%)"
typography:
  title:
    fontFamily: "var(--font-geist-sans), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "var(--font-geist-sans), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  helper:
    fontFamily: "var(--font-geist-sans), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-geist-sans), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "var(--font-geist-sans), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "6px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "32px"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-record-active:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
    size: "32px"
  input-number:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
    height: "32px"
  task-navigation:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    height: "40px"
  dock-panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
  timeline-key:
    textColor: "{colors.primary}"
    width: "26px"
    height: "29px"
  animation-clip:
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    padding: "0 6px"
    height: "24px"
---

# Design System: 三林老街 — Scene workbench

## Overview

**Creative North Star: "Unity/Timeline workbench"**

This is the scoped design record for `app/manage/scenes`, covering the scene asset editor at `/manage/scenes/[id]`. It inherits the management console's neutral semantic colors, Geist and Chinese system-font stack, and shared controls. It adds a compact authoring composition: persistent docks, explicit tools, and a timeline connected to the same selected object and current time.

The visual character is quiet, precise, and dense. Tonal panels and hairline boundaries keep the real 3D subject prominent. Desktop supports simultaneous authoring; narrow screens expose one task panel at a time for preview and basic editing. Selection, playback, and save state remain legible as the layout changes.

This local record does not replace [the global design system](../../../docs/design-system.md) or [PRODUCT.md](../../../PRODUCT.md). The confirmed Unity/Timeline direction and narrow-scope workflow exemption remain in [the surface brief](../../../.impeccable/surfaces/app-manage-scenes-components-sceneeditor-tsx.md). The implemented sources, especially [scene-editor.css](components/scene-editor.css), govern actual geometry. Frontmatter records the inherited default light-theme values; production continues to resolve shared CSS variables from [globals.css](../../globals.css). Dark-theme readiness is not claimed by this documentation. The sidecar’s synthesized tonal ramps are display metadata, not additional runtime palette tokens.

**Key Characteristics:**

- Neutral semantic surfaces with restrained selection tints.
- One selected instance and one current time across the authoring panes.
- Flat, resizable desktop docks and task-based narrow-screen navigation.
- Compact named controls, precise numeric inputs, and visible save status.

## Colors

The palette is the incumbent management palette: ink controls on pale neutral surfaces, with semantic state colors used where a state must be noticed.

### Primary

- **Control Ink** (`primary`): save, active playback, timeline keys, playhead, and selection treatments. Selection uses translucent ink rather than a new brand accent.
- **Reverse Paper** (`primary-foreground`): text and icons on filled primary controls.

### Neutral

- **Canvas Paper** (`background`): toolbar, fields, inspector, track labels, and timeline.
- **Reading Ink** (`foreground`): primary text, icons, and values.
- **Quiet Surface** (`secondary`, `muted`, `accent`): selected tools, dock headings, stage backdrop, hover surfaces, and footer. Their separate semantic names remain meaningful even when the default light values match.
- **Surface Ink** (`secondary-foreground`, `accent-foreground`): foregrounds paired with secondary and hover surfaces.
- **Supporting Gray** (`muted-foreground`): secondary labels, hints, and inactive indicators.
- **Hairline Gray** (`border`, `input`): dock dividers and control boundaries.
- **Focus Ink** (`ring`): visible keyboard focus.

The `success` and `warning` tokens distinguish saved and unsaved dots beside explicit status text. The `destructive` family carries errors, removal emphasis, and the existing active-record state; recording is a local operational use, not a general danger-color rule. A state must remain understandable from its label, shape, or pressed state without relying on its color alone.

**The Shared Palette Rule.** Scene chrome resolves the existing semantic color variables. Do not establish a parallel scene brand palette from viewport helper colors or model materials.

## Typography

**Body Font:** Geist, followed by PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, and the shared system sans-serif fallbacks.
**Label/Mono Font:** The same inherited sans-serif stack; numeric fields use tabular numerals, not a separate monospace family.

**Character:** Compact, clear bilingual UI typography. Weight and position establish hierarchy; Chinese text retains normal letter spacing. The scene workbench does not introduce display typography or a new font definition.

### Hierarchy

- **Title** (`title`): empty-scene and loading headings using the shared small heading role.
- **Body** (`body`): stage guidance and substantial error/loading copy.
- **Helper** (`helper`): object names, inspector hints, and supporting UI copy; semibold is used for selected-object headings.
- **Label** (`label`): dock headings, time values, axes, metadata, and status. Dock headings use the shared semibold modifier.
- **Control** (`control`): small button labels. Numeric fields retain the shared input's responsive text sizing: base size below the shared medium breakpoint, small size above it.

**The Microtext Rule.** Compact labels describe controls and values; they are not a template for long prose. Preserve the shared Text component's role and tone APIs when adding explanatory content.

## Layout

The workspace fills the viewport and contains overflow within individual docks. On desktop, the header is (56px), the left hierarchy/library starts at (232px), and the inspector starts at (284px). The stage takes the remaining width, reserving at least (240px). The footer is (26px). The library occupies (46%) of the left dock with its own scroll area. [SceneDockLayout](components/SceneDockLayout.tsx) uses the existing react-grid-layout library with (1px) grid units; [dock-layout.ts](../../../lib/scene/dock-layout.ts) governs the geometry.

Vertical separators adjust the left dock from (180px) and the inspector from (260px), each up to (420px) when the remaining space permits the stage reserve. For available dock height H, the timeline starts at `clamp(240px, (H + 82px) × 0.34, 360px)`, then fits within adaptive bounds: minimum `min(180px, H / 3)` and maximum `H − min(220px, H / 2)`. This keeps stage space on shorter viewports. Resizing remains available at all desktop widths above (800px). Dock sizes are view preferences and are not saved into the scene asset.

At widths up to (800px), the header becomes (52px) and a (40px) row of Scene, Objects, Inspector, and Timeline task tabs selects the visible pane. Dock resizing is hidden. Timeline becomes the available main panel, its transport wraps, and its label column is (148px). The track sheet keeps a minimum width of (540px) with horizontal scrolling and sticky labels rather than compressing keyframes beyond use. At the shared small breakpoint (640px), save status moves from beside the title to below it; its text and dot remain visible.

Preview hides hierarchy, inspector, editing gizmos, and grid; the stage expands and the timeline becomes a (76px) playback strip. On narrow screens, preview also hides task tabs. The standard spacing rhythm is the frontmatter's (4px) multiples, with (12px) dock insets and (8px) control gaps recurring throughout.

**The One Selection, One Time Rule.** Hierarchy, viewport, inspector, and timeline reflect the same instance selection and playhead. Changing panels must not create an independent editing context.

**The Visible Save Rule.** Saved, unsaved, and saving feedback stays in the header at every supported width, including preview and task-panel views.

## Elevation & Depth

Depth comes primarily from muted headers, thin borders, scroll containment, sticky timeline labels, and the actual 3D stage. Docks do not float above one another. Shared filled and outline buttons retain their existing small shadows; scene number and search inputs explicitly remove their shared input shadow. The stage hint is a translucent paper surface, and the selected mobile tab uses an inset bottom marker.

**The Docked Surface Rule.** Keep core authoring controls within their panes. The native Theatre floating editor is hidden for this workbench; avoid stacking another inspector or timeline over the scene.

Shared controls use their existing color transitions. The workspace honors reduced motion by removing transitions and shortening CSS animation duration. This CSS policy does not claim to disable the user's explicit 3D playback.

## Shapes

The workspace and dock boundaries are rectangular with hairline separators. Controls use the incumbent small rounded corners from the frontmatter. The timeline's key diamonds and pointed playhead are functional position markers; animation clips are shallow outlined bars with compact corner rounding. A small status dot complements save text. These shapes communicate function rather than decorate panels.

Focus is an inset outline (2px) using the shared ring token. Dock separator hit regions are (8px), with centered grips (3 × 28px), rotated for the horizontal edge. Hover and focus use primary at (15%) opacity. Grip corners (2px) and the clip-time badge corners (3px) are local microcontrol details, not additions to the shared radius scale. Do not infer card-based page layouts from the rounded controls.

## Components

### Buttons

Compact shared controls keep actions stable in dense chrome.

- **Primary:** the small filled save button uses the inherited primary pair; playback uses the same filled variant while active.
- **Secondary:** selected viewport tools, preview state, and inactive playback use the existing neutral filled variant.
- **Ghost:** navigation, undo/redo, library addition, timeline controls, and group-key toggles stay visually quiet until interaction.
- **Outline:** the empty-stage add-model action uses the shared outlined control.
- **State:** active recording uses the existing destructive variant and a filled circle. Pressed or expanded state is exposed programmatically where applicable.
- **Hover / Focus:** inherit shared color feedback and the workspace focus outline. Icon-only actions have accessible names and shortcut titles where supported. Disabled controls retain shared disabled styling.

### Inputs / Fields

Precise, named fields complement the viewport gizmo.

- **Style:** numeric fields are compact, rounded, shadowless, and use tabular numerals. Axes retain visible X/Y/Z labels and accessible group-and-axis names.
- **Behavior:** complete finite edits commit on blur or Enter; Escape discards the temporary draft. Transient blank or minus input is not committed. Transform values are clamped to their field bounds.
- **Units:** position is shown in metres; rotation is shown in degrees; scale is unitless. Transport displays seconds and a (30fps) time grid.
- **State:** transform and animation-edit fields are disabled during playback. The title input looks quiet at rest and exposes its boundary on hover/focus.

### Navigation

Desktop navigation is spatial: hierarchy/library, scene, inspector, then timeline. Narrow-screen task tabs use equal-width buttons, explicit labels, pressed states, and an inset selected marker. The header keeps back, title, undo/redo, preview, save, and save status accessible as space contracts.

### Docks and Hierarchy

Flat panels use a muted heading band (36px), borders, and independent scroll regions. Hierarchy selection adds a pale primary tint and subtle outline; model names take available width and truncate within their row. Available library models use grab/grabbing cursors and native dragging with the scene-model MIME type. The stage accepts known library models and projects the drop through the current camera onto ground Y = 0, within the existing position bounds (±100m). During hover, a status message explains placement availability; a valid position adds a circular target (24px) and an inset stage outline. The named add button remains the keyboard and narrow-screen fallback, placing the model at the origin. Existing model content supplies the visual subject; empty and loading states supply clear next actions or status.

### Inspector and Timeline

The Inspector shows the selected instance's Position, Rotation, and Scale groups, each with a diamond key control. A filled diamond marks a key at the current time. The same groups appear under the object's timeline row; grouping keeps nine numeric channels manageable without promising a standalone curve editor.

The ruler, sticky track labels, and vertical playhead align every lane to the same time. Diamond key controls support seek, drag, keyboard frame movement, and deletion. GLB animation clips are distinct horizontal bars with grab/grabbing cursors. Dragging preserves the grabbed offset, respects timeline zoom, and snaps to the (30fps) grid. A temporary time badge follows the draft; releasing commits one move, while Escape or pointer cancellation restores the original start. Arrow keys move one frame, or ten frames with Shift; the inspector's numeric start remains available. Preview retains transport and a seek slider while removing authoring tracks.

### Resizers and Keyboard Controls

The existing react-grid-layout library owns pointer resizing; the separator presents its name, orientation, current value, and adaptive bounds. Arrow keys resize in (10px) steps; Home and End reach the bounds. W/E/R select transform tools, F frames the scene content, Space toggles playback, Ctrl/Command S saves, and Ctrl/Command Z / Shift Z undo or redo. Text fields retain native editing shortcuts. These keyboard alternatives complement named pointer controls. The dock, movable clip, and model drop-zone states have dedicated props-driven Storybook stories.

## Do's and Don'ts

### Do:

- **Do** inherit global semantic tokens, shared controls, and the existing bilingual font stack.
- **Do** keep selection and current time consistent across every pane and task tab.
- **Do** keep save state visible as text and a status marker at narrow widths.
- **Do** preserve named controls, visible focus, numeric editing, and keyboard timeline operations.
- **Do** document new component states in props-driven Storybook stories alongside the implementation.

### Don't:

- **Don't** replace the global management design system with this scoped workbench composition.
- **Don't** reintroduce a floating Theatre editor stack over the docked workbench.
- **Don't** treat model materials or hardcoded 3D helper colors as reusable interface palette tokens.
- **Don't** hide authoring state to fit a narrow screen; use the existing task panels and timeline scrolling.
- **Don't** infer mesh editing, audio/video sequencing, Unity file interoperability, or a standalone curve editor from the Unity/Timeline reference.
