---
name: extract-design-system
description: Generate or refine a structured design-system extraction and `design.md` for an existing Moodboard Capture record.
---

# Extract Design System

Use `extract_design_system` when the user wants a deeper breakdown of a saved reference rather than just taste-memory capture.

## Good fits

- "Generate a design.md for that capture"
- "Extract the design system from this saved reference"
- "Focus on typography and components"
- "Re-run the design analysis for record `<id>`"
- "Give me a structured breakdown of the colors, layout, and illustration system"

## Command

- `extract_design_system`
  - Required: `recordId`
  - Optional: `destinationPath`, `facets`, `force`

## Supported facets

- `colors`
- `typography`
- `layout`
- `components`
- `imagery`
- `motion`
- `dos-donts`

## Notes

- This works on an existing saved record, not a raw URL by itself.
- It rewrites `design-docs/references/<recordId>/design-system.json` and `design-docs/references/<recordId>/design.md`.
- Motion analysis is static-first in v1, so call out low confidence when discussing animation or interaction behavior from a screenshot.
