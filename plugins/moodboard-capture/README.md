# Moodboard Capture

Save website screenshots or local images into a moodboard library from Codex.

## What it does

- Captures one desktop full-page PNG per website URL
- Imports an existing local image or desktop screenshot
- Stores assets under `assets/` in the resolved moodboard destination
- Appends structured inspiration records to `library.jsonl`
- Accepts optional taste metadata inline: `tags`, `whyLiked`, and `styleCues`

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
- `tags` (optional string array)
- `whyLiked` (optional string)
- `styleCues` (optional string array)

## CLI examples

```bash
cd plugins/moodboard-capture
npm install

node ./scripts/cli.js \
  --url https://example.com \
  --tag editorial \
  --tag "soft gradients" \
  --styleCue "muted palette" \
  --whyLiked "I like the layered hero composition."

node ./scripts/cli.js \
  --localImagePath /Users/me/Desktop/inspiration.png \
  --tag typography \
  --styleCue "oversized serif" \
  --whyLiked "The crop and type scale feel premium."
```

## Install from this repo

```bash
cd plugins/moodboard-capture
npm install
cd ../..
codex plugin marketplace add .
```

Then enable/install `Moodboard Capture` in the Codex UI if Codex does not enable it automatically.
