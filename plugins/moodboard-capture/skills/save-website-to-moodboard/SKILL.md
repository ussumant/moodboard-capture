---
name: save-website-to-moodboard
description: Save inspiration into a moodboard library, extract taste memory, and generate design-system docs using the Moodboard Capture plugin.
---

# Taste Workbench

Use `capture_taste` when the user wants to save inspiration and capture what makes it good.
Use `extract_design_system` when the user wants a deeper design-system breakdown, a `design.md`, or a focused facet like typography or components.
Use `summarize_taste` when the user wants a structured brief of what the current taste profile means.
Use `visualize_taste` when the user wants moodboard images that express the accumulated taste profile.

## When to use it

- "Save this website to the moodboard"
- "Capture https://example.com into moodboard"
- "Save this screenshot from my desktop into the moodboard"
- "Save this and explain what makes the design work"
- "Capture this reference and remember my taste for future design work"
- "Generate a design.md for this saved reference"
- "Extract the typography and component system from that capture"
- "Summarize my taste so far"
- "Show me visuals of my taste"

## Primary commands

- `capture_taste`
  - Required: exactly one of `url` or `localImagePath`
  - Preferred optional input: `userNote`
  - Optional extraction focus: `facets`
  - Backward-compatible optional input: `destinationPath`, `tags`, `whyLiked`, `styleCues`
- `extract_design_system`
  - Required: `recordId`
  - Optional: `destinationPath`, `facets`, `force`
- `summarize_taste`
  - Optional: `destinationPath`, `profilePath`
- `visualize_taste`
  - Optional: `destinationPath`, `summaryPath`, `directions`
- Compatibility aliases still work:
  - `save_inspiration_to_moodboard`
  - `save_website_to_moodboard`
  - `generate_taste_visuals`

## Behavior

- Captures one desktop full-page PNG for website URLs
- Imports one local image file for desktop screenshots or saved inspiration
- Attempts one unified AI analysis pass after saving the asset
- Saves to the explicit destination when provided
- Otherwise uses the canonical inbox at `~/Documents/Moodboards/Inbox`
- Stores assets under `assets/`
- Appends metadata to `library.jsonl`
- Updates `taste-profile.json` locally when taste analysis succeeds
- Writes per-reference design artifacts under `design-docs/references/<recordId>/`
- `summarize_taste` writes `taste-summary.json`
- `summarize_taste` also writes library-level design docs under `design-docs/library/`
- `visualize_taste` renders summary-based taste boards into `taste-boards/`

## Response expectations

Tell the user:
- where the asset was saved
- which index file was updated
- whether taste analysis completed, failed, or is pending
- whether design extraction completed, failed, or is pending
- where `design-system.json` and `design.md` were written
- which profile artifacts were updated
- whether a fallback destination was used
- when summarizing taste, where the summary and library design artifacts were saved
- when visualizing taste, which directions were rendered and where the boards were saved
