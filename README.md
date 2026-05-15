# Moodboard Capture

`Moodboard Capture` is a Codex plugin that saves website screenshots or local images into a repo moodboard folder or personal inbox, builds reusable taste-memory profiles, and can extract structured design-system docs for future AI-assisted design work.

## Workbench commands

- `capture_taste`
- `extract_design_system`
- `summarize_taste`
- `derive_design_directions`
- `plan_landing_page`
- `visualize_taste`
- `open_moodboard_board`
- `landing-page-from-taste` skill for orchestrating landing-page planning from a moodboard library
- Compatibility aliases remain available for the older save-oriented surface

## Features

- One-command desktop full-page website capture
- Local image or desktop screenshot import
- Deterministic default inbox at `~/Documents/Moodboards/Inbox`
- `library.jsonl` index per destination folder
- Per-capture taste analysis with `visualTraits`, `whyItWorks`, and reusable design signals
- Per-reference design-system extraction with:
  - `design-docs/references/<recordId>/design-system.json`
  - `design-docs/references/<recordId>/design.md`
  - `design-docs/references/<recordId>/explain.json`
  - `design-docs/references/<recordId>/explain.md`
- Library-level design synthesis with:
  - `design-docs/library/design-system.json`
  - `design-docs/library/design.md`
- Evidence-backed direction synthesis with:
  - `design-docs/directions/<directionId>/design-system.json`
  - `design-docs/directions/<directionId>/design.md`
  - `design-docs/directions/<directionId>/explain.json`
  - `design-docs/directions/<directionId>/explain.md`
- Local ingredient board viewing with:
  - `board-view/background.svg`
  - `board-view/board-manifest.json`
  - `board-view/board-state.json`
- Landing-page planning with:
  - `landing-page-docs/landing-page-brief.json`
  - `landing-page-docs/landing-page-brief.md`
  - `landing-page-docs/provenance.json`
  - `landing-page-docs/explain.json`
  - `landing-page-docs/explain.md`
- `design-system.json` now carries an explicit `ingredients` layer so references, directions, and landing-page briefs can stay machine-readable and traceable
- Taste-visual board generation from the accumulated profile and design synthesis
- Optional `userNote` input, optional design `facets`, and legacy metadata support
- Works with `https://`, `http://`, and `file://` URLs

## Repo layout

- `.agents/plugins/marketplace.json` - marketplace manifest for Codex
- `plugins/moodboard-capture` - actual plugin package
- `docs/taste-workbench-use-cases.md` - product use cases, example forms, and generation workflows
- `site/` - static landing page for the open-source repo, deployable with the included GitHub Pages workflow

## Landing page

To preview the landing page locally:

```bash
cd site
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Install from GitHub

For most users, the shortest install path is the public repository source:

```bash
codex plugin marketplace add ussumant/moodboard-capture
```

Then enable/install `Moodboard Capture` in Codex if it is not already enabled.

## Develop locally

If you want to edit the plugin from a local checkout:

```bash
git clone https://github.com/ussumant/moodboard-capture.git
cd moodboard-capture/plugins/moodboard-capture
npm install

cd ../..
codex plugin marketplace add .
```

## Upgrade

After pulling new changes to a local checkout, refresh the local plugin registration:

```bash
./scripts/refresh-plugin.sh
```

If the plugin dependencies changed too:

```bash
./scripts/refresh-plugin.sh --install-deps
```

If Codex does not pick up the update automatically, reload Codex or disable/re-enable the plugin in the Codex UI.

## Development

```bash
cd plugins/moodboard-capture
npm install
node ./scripts/cli.js capture --url https://example.com
```

Refresh the local plugin registration after edits:

```bash
./scripts/refresh-plugin.sh
```

If dependencies changed first:

```bash
./scripts/refresh-plugin.sh --install-deps
```

Example local-image import:

```bash
node ./scripts/cli.js capture \
  --localImagePath /Users/me/Desktop/inspiration.png \
  --userNote "Love the composition and the confident type scale."
```

Example design-system regeneration:

```bash
node ./scripts/cli.js extract-design-system \
  --recordId <record-id> \
  --facet typography \
  --facet components \
  --force
```

Example direction synthesis:

```bash
node ./scripts/cli.js derive-design-directions \
  --directionCount 3
```

Example landing-page planning:

```bash
node ./scripts/cli.js plan-landing-page \
  --directionId infra-editorial \
  --targetAudience "Builders evaluating whether this Codex plugin can generate trustworthy design direction" \
  --productGoal "Create an install-forward open-source landing page with real proof."

node ./scripts/cli.js open-moodboard-board \
  --destinationPath /Users/me/Documents/Moodboards/Inbox
```

## Analysis behavior

- Asset save happens first
- If `OPENAI_API_KEY` is configured, the plugin attempts one unified analysis pass that produces both taste memory and design-system extraction
- If analysis cannot run, the capture is still saved and both analysis layers are marked as pending
- If analysis fails, the capture is still saved and the failure is recorded in the saved record
- `design.md` is derived from structured extraction locally, not from a second model call
- `design-system.json` is the canonical machine-readable ingredient bank for references, directions, and landing-page planning

## Design-system extraction

- `capture_taste` auto-attempts per-reference design extraction on every save
- `extract_design_system` can re-run extraction for an existing `recordId`
- Per-reference extraction also writes explain-mode artifacts that map ingredients back to evidence, regions, user notes, and references
- Supported focus facets are:
  - `colors`
  - `typography`
  - `layout`
  - `components`
  - `imagery`
  - `motion`
  - `dos-donts`
- Motion analysis is static-first and confidence-limited in v1
- Interesting regions are described in JSON and Markdown, but no cropped sub-images are produced

## Taste visual generation

- The plugin summarizes taste into `taste-summary.json`
- It also writes library-level design synthesis into `design-docs/library/`
- `derive_design_directions` turns the current library into 2-3 richer direction artifacts grounded in extracted references
- `plan_landing_page` turns one chosen direction into a section-by-section brief plus provenance
- `visualize_taste` uses the taste summary, prefers direction-level design artifacts when present, and consumes recipe-level ingredients such as materiality, realism, CTA tone, and artifact-display strategy
- `open_moodboard_board` opens the active library as a local ingredient board with grouped captures, tiny chips, and a detail sidebar
- By default it renders three branches:
  - `infra-editorial`
  - `warm-technical`
  - `strange-systems`
- Generated images are saved in `~/Documents/Moodboards/Inbox/taste-boards/landing-page` when direction artifacts exist, otherwise `taste-boards`

## Visual board viewer

- `open_moodboard_board` creates a board layer inside the active library, then opens a local read-only viewer
- The viewer uses a deterministic mesh-board background and groups captures into ingredient buckets like `color-mood`, `typography`, `materiality`, and `proof-ui`
- Cards stay visually quiet with small color-coded chips, and clicking a card opens a detail sidebar with the extracted context
- This is a plugin-local workflow surface, not the public landing page

## Default save behavior

Destination resolution order:

1. Explicit `destinationPath`
2. `~/Documents/Moodboards/Inbox`

## License

MIT
