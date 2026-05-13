# Moodboard Capture

Save inspiration assets into a moodboard library from Codex and build reusable taste memory for future AI-assisted design work.

## What it does

- Captures one desktop full-page PNG per website URL
- Imports an existing local image or desktop screenshot
- Stores assets under `assets/` in the resolved moodboard destination
- Appends structured inspiration records to `library.jsonl`
- Attempts per-capture taste analysis with `visualTraits`, `whyItWorks`, and `designSignals`
- Updates `taste-profile.json` locally and `workspace-taste-profile.json` for the workspace when analysis succeeds
- Accepts an optional `userNote` and still supports `tags`, `whyLiked`, and `styleCues` for backward compatibility

## Destination order

1. Explicit `destinationPath`
2. `Knowledge/Design/moodboard-assets` in the current workspace
3. First workspace directory whose name contains `moodboard`
4. `~/Documents/Moodboards/Inbox`

## Tools

- `save_inspiration_to_moodboard`
- `save_website_to_moodboard` compatibility alias

## `save_inspiration_to_moodboard` arguments

- `url` or `localImagePath` (exactly one required)
- `destinationPath` (optional)
- `userNote` (preferred optional string)
- `tags` (optional string array)
- `whyLiked` (optional string)
- `styleCues` (optional string array)

## CLI examples

```bash
cd plugins/moodboard-capture
npm install

node ./scripts/cli.js \
  --url https://example.com \
  --userNote "I like how the hero feels calm but still editorial."

node ./scripts/cli.js \
  --localImagePath /Users/me/Desktop/inspiration.png \
  --userNote "The crop and type scale feel premium."
```

## Installation

First-time setup from this repo:

```bash
cd plugins/moodboard-capture
npm install
cd ../..
codex plugin marketplace add .
```

Then enable/install `Moodboard Capture` in the Codex UI if Codex does not enable it automatically.

## Upgrade

After pulling new changes, refresh the local plugin registration from the repo root:

```bash
./scripts/refresh-plugin.sh
```

If dependencies changed too:

```bash
./scripts/refresh-plugin.sh --install-deps
```

If Codex still shows the old version, reload Codex or disable/re-enable the plugin in the UI.

## Analysis behavior

- Capture always saves the asset first
- If `OPENAI_API_KEY` is available, the plugin attempts image-based taste analysis during the same save flow
- If analysis is unavailable, the record is saved with `analysisStatus: "pending"`
- If analysis fails after being attempted, the record is saved with `analysisStatus: "failed"` and the error is recorded

## Profile artifacts

- `library.jsonl`: append-only capture records with source metadata and taste-analysis fields
- `taste-profile.json`: destination-level profile built from completed analyses in the current library
- `workspace-taste-profile.json`: rolled-up workspace profile built from nearby moodboard libraries
