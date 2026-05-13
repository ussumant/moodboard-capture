---
name: save-website-to-moodboard
description: Save a website screenshot or local image into a moodboard library and build reusable taste memory using the moodboard capture plugin.
---

# Save Inspiration And Taste To Moodboard

Use the `save_inspiration_to_moodboard` tool when the user wants to save inspiration and capture what makes it good.

## When to use it

- "Save this website to the moodboard"
- "Capture https://example.com into moodboard"
- "Save this screenshot from my desktop into the moodboard"
- "Save this and explain what makes the design work"
- "Capture this reference and remember my taste for future design work"
- "Save this to /some/path"

## Tool contract

- Required: exactly one of `url` or `localImagePath`
- Preferred optional input: `userNote`
- Backward-compatible optional input: `destinationPath`, `tags`, `whyLiked`, `styleCues`

## Behavior

- Captures one desktop full-page PNG for website URLs
- Imports one local image file for desktop screenshots or saved inspiration
- Attempts AI taste analysis after saving the asset
- Saves to the explicit destination when provided
- Otherwise prefers `Knowledge/Design/moodboard-assets`
- Otherwise uses the first workspace folder containing `moodboard`
- Otherwise falls back to `~/Documents/Moodboards/Inbox`
- Stores assets under `assets/`
- Appends metadata to `library.jsonl`
- Updates `taste-profile.json` locally when analysis succeeds
- Updates `workspace-taste-profile.json` for the broader workspace when analysis succeeds
- If analysis is unavailable or fails, the asset is still saved and the record notes the status

## Response expectations

Tell the user:
- where the asset was saved
- which index file was updated
- whether taste analysis completed, failed, or is pending
- which profile artifacts were updated
- whether a fallback destination was used
