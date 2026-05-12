---
name: save-website-to-moodboard
description: Save a website screenshot into a moodboard folder using the moodboard capture plugin.
---

# Save Website To Moodboard

Use the `save_website_to_moodboard` tool when the user wants to capture a website into a moodboard.

## When to use it

- "Save this website to the moodboard"
- "Capture https://example.com into moodboard"
- "Save this to /some/path"

## Tool contract

- Required: `url`
- Optional: `destinationPath`

## Behavior

- Captures one desktop full-page PNG
- Saves to the explicit destination when provided
- Otherwise prefers `Knowledge/Design/moodboard-assets`
- Otherwise uses the first workspace folder containing `moodboard`
- Otherwise falls back to `~/Documents/Moodboards/Inbox`
- Appends metadata to `captures.jsonl`

## Response expectations

Tell the user:
- where the screenshot was saved
- which index file was updated
- whether a fallback destination was used
