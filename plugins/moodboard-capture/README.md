# Moodboard Capture

Save a website screenshot into a moodboard folder from Codex.

## What it does

- Captures one desktop full-page PNG per URL
- Resolves the destination folder automatically
- Appends metadata to `captures.jsonl`

## Destination order

1. Explicit `destinationPath`
2. `Knowledge/Design/moodboard-assets` in the current workspace
3. First workspace directory whose name contains `moodboard`
4. `~/Documents/Moodboards/Inbox`

## Tool

- `save_website_to_moodboard`

Arguments:

- `url` (required)
- `destinationPath` (optional)

## Install from this repo

```bash
cd plugins/moodboard-capture
npm install
cd ../..
codex plugin marketplace add .
```

Then enable/install `Moodboard Capture` in the Codex UI if Codex does not enable it automatically.
