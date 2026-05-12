# Moodboard Capture

`Moodboard Capture` is a Codex plugin that saves website screenshots into a repo moodboard folder or a personal inbox.

## Features

- One-command desktop full-page capture
- Repo-aware destination resolution
- `captures.jsonl` index per destination folder
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

## Default save behavior

Destination resolution order:

1. Explicit `destinationPath`
2. `Knowledge/Design/moodboard-assets` in the current workspace
3. First workspace directory whose name contains `moodboard`
4. `~/Documents/Moodboards/Inbox`

## License

MIT
