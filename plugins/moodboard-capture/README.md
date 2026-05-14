# Moodboard Capture

Save inspiration assets into a moodboard library from Codex, build reusable taste memory, and extract design-system docs for future AI-assisted design work.

## Workbench commands

- `capture_taste`: save inspiration, update the active taste profile, and auto-attempt per-reference design extraction
- `extract_design_system`: regenerate or refine `design-system.json` and `design.md` for an existing saved reference
- `summarize_taste`: synthesize the active library into a structured taste brief plus library-level design system docs
- `visualize_taste`: generate visual boards from the summary artifact and library design synthesis
- Compatibility aliases remain available:
  - `save_inspiration_to_moodboard`
  - `save_website_to_moodboard`
  - `generate_taste_visuals`

## What it does

- Captures one desktop full-page PNG per website URL
- Imports an existing local image or desktop screenshot
- Stores assets under `assets/` in the resolved moodboard destination
- Appends structured inspiration records to `library.jsonl`
- Attempts per-capture taste analysis with `visualTraits`, `whyItWorks`, and `designSignals`
- Generates per-reference design extraction artifacts under:
  - `design-docs/references/<recordId>/design-system.json`
  - `design-docs/references/<recordId>/design.md`
- Generates library-level synthesis under:
  - `design-docs/library/design-system.json`
  - `design-docs/library/design.md`
- Accepts an optional `userNote`, optional design `facets`, and still supports `tags`, `whyLiked`, and `styleCues` for backward compatibility

## Destination order

1. Explicit `destinationPath`
2. `~/Documents/Moodboards/Inbox`

## Tools

- `capture_taste`
- `extract_design_system`
- `summarize_taste`
- `visualize_taste`
- `save_inspiration_to_moodboard` compatibility alias
- `save_website_to_moodboard` compatibility alias
- `generate_taste_visuals` compatibility alias

## `capture_taste` arguments

- `url` or `localImagePath` (exactly one required)
- `destinationPath` (optional)
- `userNote` (preferred optional string)
- `facets` (optional string array)
- `tags` (optional string array)
- `whyLiked` (optional string)
- `styleCues` (optional string array)

## `extract_design_system` arguments

- `recordId` (required)
- `destinationPath` (optional)
- `facets` (optional string array)
- `force` (optional boolean)

## CLI examples

```bash
cd plugins/moodboard-capture
npm install

node ./scripts/cli.js capture \
  --url https://example.com \
  --userNote "I like how the hero feels calm but still editorial."

node ./scripts/cli.js capture \
  --localImagePath /Users/me/Desktop/inspiration.png \
  --userNote "The crop and type scale feel premium."

node ./scripts/cli.js extract-design-system \
  --recordId <record-id> \
  --facet typography \
  --facet components \
  --force
```

## Installation

Install directly from the public GitHub repo:

```bash
codex plugin marketplace add ussumant/moodboard-capture
```

Then enable/install `Moodboard Capture` in the Codex UI if Codex does not enable it automatically.

If you are developing from a local checkout instead:

```bash
cd plugins/moodboard-capture
npm install
cd ../..
codex plugin marketplace add .
```

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
- If `OPENAI_API_KEY` is available, the plugin attempts one unified image-based analysis pass during the same save flow
- If analysis is unavailable, the record is saved with both `analysisStatus: "pending"` and `designExtractionStatus: "pending"`
- If analysis fails after being attempted, the record is saved with failure details and the asset remains intact
- `design.md` is derived locally from the structured extraction result, not from a second model call

## Design-system extraction

- `capture_taste` auto-attempts per-reference design extraction on every save
- `extract_design_system` can re-run design extraction for an existing saved record
- Supported facets are:
  - `colors`
  - `typography`
  - `layout`
  - `components`
  - `imagery`
  - `motion`
  - `dos-donts`
- Motion analysis is static-first in v1 and should be treated as low-confidence unless reinforced by user notes
- Interesting regions are described in JSON and Markdown rather than exported as cropped image assets

## Taste visual generation

- `summarize_taste` creates `taste-summary.json` beside the active library
- `summarize_taste` also creates:
  - `design-docs/library/design-system.json`
  - `design-docs/library/design.md`
- `visualize_taste` reads `taste-summary.json` and prefers the library design synthesis when present
- Default directions are:
  - `infra-editorial`
  - `warm-technical`
  - `strange-systems`
- Generated boards are saved under `taste-boards/` inside the active library root
- This command requires `OPENAI_API_KEY`

## Profile artifacts

- `library.jsonl`: capture records with source metadata, taste-analysis fields, and design extraction fields
- `taste-profile.json`: destination-level profile built from completed analyses in the current library
- `taste-summary.json`: structured synthesis of stable preferences, anti-patterns, tensions, and branch directions
- `design-docs/references/<recordId>/design-system.json`: per-reference structured design extraction
- `design-docs/references/<recordId>/design.md`: per-reference Markdown design system doc
- `design-docs/library/design-system.json`: library-level design synthesis
- `design-docs/library/design.md`: library-level Markdown design system doc
- `workspace-taste-profile.json`: rolled-up profile stored beside the active library in the current destination
