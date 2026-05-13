# Moodboard Capture

`Moodboard Capture` is a Codex plugin that saves website screenshots or local images into a repo moodboard folder or personal inbox and builds reusable taste-memory profiles for later AI-assisted design work.

## Features

- One-command desktop full-page website capture
- Local image or desktop screenshot import
- Repo-aware destination resolution
- `library.jsonl` index per destination folder
- Per-capture taste analysis with `visualTraits`, `whyItWorks`, and reusable design signals
- Local and workspace-level taste profile artifacts
- Optional `userNote` input, with legacy metadata still supported
- Works with `https://`, `http://`, and `file://` URLs

## Repo layout

- `.agents/plugins/marketplace.json` - marketplace manifest for Codex
- `plugins/moodboard-capture` - actual plugin package

## Installation

First-time setup:

```bash
cd /Users/sumant/dev/personalos/Coding/moodboard-capture/plugins/moodboard-capture
npm install

cd /Users/sumant/dev/personalos/Coding/moodboard-capture
codex plugin marketplace add .
```

Then enable/install `Moodboard Capture` in Codex if it is not already enabled.

## Upgrade

After pulling new changes to this repo, refresh the local plugin registration:

```bash
cd /Users/sumant/dev/personalos/Coding/moodboard-capture
./scripts/refresh-plugin.sh
```

If the plugin dependencies changed too:

```bash
cd /Users/sumant/dev/personalos/Coding/moodboard-capture
./scripts/refresh-plugin.sh --install-deps
```

If Codex does not pick up the update automatically, reload Codex or disable/re-enable the plugin in the Codex UI.

## Development

```bash
cd plugins/moodboard-capture
npm install
node ./scripts/cli.js --url https://example.com
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
node ./scripts/cli.js --localImagePath /Users/me/Desktop/inspiration.png --userNote "Love the composition and the confident type scale."
```

## Taste analysis behavior

- Asset save happens first
- If `OPENAI_API_KEY` is configured, the plugin attempts taste analysis in the same flow
- If analysis cannot run, the capture is still saved and marked as pending
- If analysis fails, the capture is still saved and the failure is recorded in the saved record

## Default save behavior

Destination resolution order:

1. Explicit `destinationPath`
2. `Knowledge/Design/moodboard-assets` in the current workspace
3. First workspace directory whose name contains `moodboard`
4. `~/Documents/Moodboards/Inbox`

## License

MIT
