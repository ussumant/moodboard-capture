# Moodboard Capture

`Moodboard Capture` is a Codex plugin that saves website screenshots or local images into a repo moodboard folder or personal inbox, builds reusable taste-memory profiles, and can extract structured design-system docs for future AI-assisted design work.

## Workbench commands

- `capture_taste`
- `extract_design_system`
- `summarize_taste`
- `visualize_taste`
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
- Library-level design synthesis with:
  - `design-docs/library/design-system.json`
  - `design-docs/library/design.md`
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

## Analysis behavior

- Asset save happens first
- If `OPENAI_API_KEY` is configured, the plugin attempts one unified analysis pass that produces both taste memory and design-system extraction
- If analysis cannot run, the capture is still saved and both analysis layers are marked as pending
- If analysis fails, the capture is still saved and the failure is recorded in the saved record
- `design.md` is derived from structured extraction locally, not from a second model call

## Design-system extraction

- `capture_taste` auto-attempts per-reference design extraction on every save
- `extract_design_system` can re-run extraction for an existing `recordId`
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
- `visualize_taste` uses the taste summary and prefers the library design synthesis when present
- By default it renders three branches:
  - `infra-editorial`
  - `warm-technical`
  - `strange-systems`
- Generated images are saved in `~/Documents/Moodboards/Inbox/taste-boards` unless another `destinationPath` is used

## Default save behavior

Destination resolution order:

1. Explicit `destinationPath`
2. `~/Documents/Moodboards/Inbox`

## License

MIT
