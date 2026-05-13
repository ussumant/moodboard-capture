---
name: save-website-to-moodboard
description: Save a website screenshot or local image into a moodboard library using the moodboard capture plugin.
---

# Save Inspiration To Moodboard

Use the `save_inspiration_to_moodboard` tool when the user wants to save inspiration into a moodboard.

## When to use it

- "Save this website to the moodboard"
- "Capture https://example.com into moodboard"
- "Save this screenshot from my desktop into the moodboard"
- "Tag this as editorial and note why I like it"
- "Save this to /some/path"

## Tool contract

- Required: exactly one of `url` or `localImagePath`
- Optional: `destinationPath`, `tags`, `whyLiked`, `styleCues`

## Behavior

- Captures one desktop full-page PNG for website URLs
- Imports one local image file for desktop screenshots or saved inspiration
- Saves to the explicit destination when provided
- Otherwise prefers `Knowledge/Design/moodboard-assets`
- Otherwise uses the first workspace folder containing `moodboard`
- Otherwise falls back to `~/Documents/Moodboards/Inbox`
- Stores assets under `assets/`
- Appends metadata to `library.jsonl`

## Response expectations

Tell the user:
- where the asset was saved
- which index file was updated
- which metadata fields were persisted when provided
- whether a fallback destination was used
