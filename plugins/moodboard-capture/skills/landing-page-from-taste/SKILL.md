---
name: landing-page-from-taste
description: Turn a Moodboard Capture library into 2-3 grounded landing-page directions, optional concept boards, and a build-ready brief with provenance.
---

# Landing Page From Taste

Use this workflow when the user wants a landing page generated from their references, taste profile, and design-system extractions rather than from generic startup aesthetics.

## Good fits

- "Build me a landing page from my moodboard"
- "Give me 2-3 directions for the site before we implement it"
- "Turn this library into a landing-page brief"
- "Use the taste profile to plan the homepage"
- "Generate landing-page directions, then show visuals, then brief one"

## Workflow

1. Run `summarize_taste` for the active library if the latest summary may be stale or missing.
2. Run `derive_design_directions` to create 2-3 evidence-backed direction artifacts.
3. Optionally run `visualize_taste` to explore concept boards or hero-system directions.
4. Run `plan_landing_page` for the chosen direction.
5. Pause for a review checkpoint before implementation work.

## Commands

- `summarize_taste`
  - Optional: `destinationPath`, `profilePath`
- `derive_design_directions`
  - Optional: `destinationPath`, `referenceIds`, `directionCount`
- `visualize_taste`
  - Optional: `destinationPath`, `summaryPath`, `directions`
- `plan_landing_page`
  - Required: `directionId`
  - Optional: `destinationPath`, `referenceIds`, `targetAudience`, `productGoal`

## Direction defaults

- `infra-editorial`
- `warm-technical`
- `strange-systems`

## Outputs

- `taste-summary.json`
- `design-docs/library/design-system.json`
- `design-docs/library/design.md`
- `design-docs/directions/<directionId>/design-system.json`
- `design-docs/directions/<directionId>/design.md`
- `landing-page-docs/landing-page-brief.json`
- `landing-page-docs/landing-page-brief.md`
- `landing-page-docs/provenance.json`
- `taste-boards/landing-page/` when concept boards are generated after direction synthesis

## Response expectations

Tell the user:
- which library was used
- which directions were generated
- which references grounded each direction
- where the direction artifacts were written
- whether concept boards were generated
- where the landing-page brief and provenance files were saved
- what review checkpoint should happen before implementation
