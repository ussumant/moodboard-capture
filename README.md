# Moodboard Capture

`Moodboard Capture` is a Codex plugin that saves website screenshots or local images into a repo moodboard folder or a personal inbox.

## Features

- One-command desktop full-page website capture
- Local image or desktop screenshot import
- Repo-aware destination resolution
- `library.jsonl` index per destination folder
- Optional taste metadata with tags, notes, and style cues
- Works with `https://`, `http://`, and `file://` URLs

## Repo layout

- `.agents/plugins/marketplace.json` - marketplace manifest for Codex
- `plugins/moodboard-capture` - actual plugin package

## Install

```bash
codex plugin marketplace add .
```

Then enable/install `Moodboard Capture` in Codex if it is not already enabled.

## Development

```bash
cd plugins/moodboard-capture
npm install
node ./scripts/cli.js --url https://example.com
```

Example local-image import:

```bash
node ./scripts/cli.js --localImagePath /Users/me/Desktop/inspiration.png --tag editorial --whyLiked "Love the composition."
```

## Default save behavior

Destination resolution order:

1. Explicit `destinationPath`
2. `Knowledge/Design/moodboard-assets` in the current workspace
3. First workspace directory whose name contains `moodboard`
4. `~/Documents/Moodboards/Inbox`

## License

MIT
