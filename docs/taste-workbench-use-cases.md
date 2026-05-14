# Moodboard Capture: Use Cases, Forms, and Generated Outputs

## Overview

`Moodboard Capture` is strongest when it is treated as a taste workbench, not just a screenshot saver.

The big value proposition is:

1. Capture a reference fast.
2. Turn it into reusable taste memory.
3. Extract design-system logic from the reference.
4. Synthesize patterns across many references.
5. Generate new visual directions, image prompts, and design briefs from that accumulated taste.

That means the product can sit at the top of the design workflow, not only in the archive layer.

## Core Value Prop

The plugin helps a builder go from:

- "I like this site, but I do not know how to explain why"

to:

- "I have a reusable taste profile, a design-system reading, a design brief, and a set of generated directions I can actually build from."

This is especially valuable for:

- founders who collect references but do not formalize the pattern
- designers who want faster reference-to-brief workflows
- engineers who need a design-system read before implementing a brand style
- AI-assisted design flows that need structured taste, not vague inspiration

## Fantastic Use Cases

### 1. Founder Taste Capture

**Input**
- Save 10-20 sites or screenshots you love
- Add short notes like:
  - "I like the severity of the layout"
  - "The type feels editorial but still SaaS"
  - "This is the right amount of warmth"

**Expected result**
- a growing `library.jsonl`
- a destination-level `taste-profile.json`
- a `taste-summary.json` that names stable preferences, tensions, and anti-patterns
- branch directions such as `infra-editorial`, `warm-technical`, or `strange-systems`

**Why it is good**
- turns fuzzy founder taste into something a designer, engineer, or image model can actually use

### 2. Competitor Design Teardown

**Input**
- Capture 5 competitor websites
- Run `extract_design_system` with facets like `typography`, `colors`, `components`, and `imagery`

**Expected result**
- one `design.md` per competitor
- a library-level design synthesis that shows recurring market patterns
- a list of what feels generic vs what feels differentiated

**Why it is good**
- gives product and brand teams a quick map of category conventions and whitespace

### 3. Design Direction Kickoff

**Input**
- Capture references for a new product or redesign
- Run `summarize_taste`
- Run `visualize_taste`

**Expected result**
- a written design brief
- a structured library design system
- multiple generated boards that interpret the same taste in different directions

**Why it is good**
- replaces the usual vague kickoff board with a real system:
  taste -> summary -> direction -> generated boards

### 4. Engineer-Facing Design Spec Generation

**Input**
- Save a reference site or screenshot
- Extract `typography`, `colors`, `layout`, and `components`

**Expected result**
- `design-system.json` for machines
- `design.md` for humans
- a much better starting point for implementation than "make it feel like X"

**Why it is good**
- helps engineers implement with fewer rounds of interpretation loss

### 5. Image Prompt Grounding

**Input**
- Build a taste library first
- Summarize it
- Generate visuals from a branch direction

**Expected result**
- prompts and generated boards grounded in actual references
- less generic image output
- clearer explanation of what visual language is being targeted

**Why it is good**
- image generation gets better when it is constrained by observed taste and design evidence

### 6. Team Taste Calibration

**Input**
- Multiple teammates capture references into one shared library
- Notes explain what each person likes or dislikes

**Expected result**
- a shared taste summary
- a clearer understanding of tensions:
  - serious vs playful
  - editorial vs product-first
  - warm vs severe

**Why it is good**
- surfaces hidden disagreements early, before implementation begins

### 7. Design QA by Reference

**Input**
- Capture the product's current website
- Capture 3-5 aspirational references
- Compare the resulting summaries and design docs

**Expected result**
- a gap map:
  - missing typography confidence
  - inconsistent color system
  - weak component rhythm
  - generic imagery

**Why it is good**
- useful for redesign planning and explaining why the current brand feels weak

## Forms We Can Add

These should be thought of as higher-level structured inputs on top of the current command surface.

### 1. Reference Capture Form

**Purpose**
- make every save richer and more intentional

**Fields**
- `sourceType`: url or local image
- `source`
- `userNote`
- `whatCaughtMyEye`
- `whyItMatters`
- `facetsToFocus`
- `projectOrTheme`

**Example**
- `source`: `https://antimetal.com/`
- `whatCaughtMyEye`: `Typography and dark/light transition`
- `whyItMatters`: `Feels like the right level of technical confidence for our product`
- `facetsToFocus`: `typography`, `colors`, `imagery`

**Expected result**
- better per-capture analysis
- stronger design extraction
- more useful later summaries

### 2. Brand Reading Form

**Purpose**
- force a deeper brand-system read of one saved reference

**Fields**
- `recordId`
- `brandArchetype`
- `focusFacets`
- `outputDepth`
- `compareAgainstCategory`

**Example**
- `brandArchetype`: `technical but not cold`
- `focusFacets`: `typography`, `colors`, `illustrations`
- `outputDepth`: `detailed`

**Expected result**
- a higher-quality `design.md`
- a clearer explanation of what the reference is actually doing

### 3. Library Synthesis Form

**Purpose**
- summarize one library into a usable brief

**Fields**
- `libraryScope`
- `goal`
- `audience`
- `emphasizeSignals`
- `highlightAntiPatterns`

**Example**
- `goal`: `Define the visual system for our new landing page`
- `audience`: `designer and engineer`
- `highlightAntiPatterns`: `generic gradients, weak hierarchy, stock-photo feel`

**Expected result**
- a stronger `taste-summary.json`
- a better downstream input for image generation and implementation

### 4. Visual Direction Form

**Purpose**
- generate a branch-specific board or image set from the library

**Fields**
- `direction`
- `targetArtifact`
- `toneWords`
- `mustKeep`
- `avoid`
- `format`

**Example**
- `direction`: `warm-technical`
- `targetArtifact`: `landing page hero and section style board`
- `toneWords`: `confident`, `clear`, `human`, `precise`
- `mustKeep`: `editorial typography`, `controlled palette`, `illustration warmth`
- `avoid`: `generic startup gloss`, `purple gradient overload`

**Expected result**
- a more specific generated board
- better image prompts
- less generic visual output

## Landing Page From Taste

This workflow is now strong enough to become a first-class product path:

1. capture references
2. extract per-reference design systems
3. summarize the active taste library
4. derive 2-3 evidence-backed directions
5. optionally visualize those directions
6. write a landing-page brief and provenance artifact

### Why it worked in practice

- The references prevented the visual direction from drifting into generic SaaS styling.
- `design-system.json` gave the pipeline a machine-readable source of truth for typography, color, layout, components, and illustration patterns.
- `design.md` remained useful because it compressed those signals into language a designer or frontend engineer could actually reason about.
- Branching into `infra-editorial`, `warm-technical`, and `strange-systems` let visual exploration happen without collapsing everything into one averaged direction.
- Image generation was useful only after the direction was chosen and bounded by extracted signals.
- A landing-page brief became the handoff artifact that kept implementation grounded.

### New workflow artifacts

- `design-docs/directions/<directionId>/design-system.json`
- `design-docs/directions/<directionId>/design.md`
- `landing-page-docs/landing-page-brief.json`
- `landing-page-docs/landing-page-brief.md`
- `landing-page-docs/provenance.json`

### Expected result

The output should be specific enough that a separate frontend engineer or agent can implement the page without inventing:
- the page thesis
- the hero visual system
- the typography pairing
- the palette strategy
- the proof blocks
- the CTA structure

### 5. Comparative Positioning Form

**Purpose**
- understand how a brand should differ from specific references

**Fields**
- `referenceSet`
- `whatToBorrow`
- `whatToAvoid`
- `desiredDifference`
- `targetBrandCharacter`

**Expected result**
- a differentiated taste brief
- a more strategic basis for generation rather than imitation

### 6. Design System to Build Form

**Purpose**
- turn taste and reference analysis into something implementation-ready

**Fields**
- `targetSurface`
- `componentsNeeded`
- `brandMode`
- `strictness`
- `deliverables`

**Example**
- `targetSurface`: `marketing site`
- `componentsNeeded`: `hero`, `nav`, `pricing cards`, `testimonials`, `footer`
- `brandMode`: `infra-editorial`
- `deliverables`: `design.md`, token suggestions, prompt starter`

**Expected result**
- a build-ready spec layer
- clearer handoff to design or engineering

## What the Output Should Feel Like

The outputs should not feel like generic AI summaries.

They should feel:

- opinionated
- evidence-backed
- implementation-relevant
- reusable across generation and coding

That means:

- typography should distinguish display vs body vs mono/utility faces
- colors should identify surfaces, accents, contrast relationships, and palette behavior
- illustrations should explain the visual role, not only say "there are illustrations"

## Best Places to Go Deeper

### Typography

The best output here would identify:

- headline family
- body/interface family
- label/mono/accent family
- rhythm and hierarchy
- letterspacing behavior
- tone effect of the type choices

**Great result**
- "This system uses a softer serif display face to create authority and editorial lift, while the interface falls back to a restrained neo-grotesk sans for product clarity."

### Colors

The best output here would identify:

- core surfaces
- primary text and inverted text
- CTA colors
- accent colors
- recurring contrast pattern
- whether the palette is flat, gradient-driven, pastel, severe, warm, etc.

**Great result**
- "The palette is mostly dark navy and white, with neon-lime as the activation signal; the lime is not decorative, it is reserved for conversion and emphasis."

### Illustrations and Imagery

The best output here would identify:

- are these diagrams, 3D objects, grain textures, product screenshots, mascots, pixel-art, or abstract shapes
- what job the illustrations do
- how much of the brand relies on them
- whether the imagery system is decorative, explanatory, atmospheric, or proof-driven

**Great result**
- "The illustration layer acts as a tension release valve for an otherwise severe technical system, using low-detail pixel cues and abstract world-building to keep the brand from feeling sterile."

## How This Feeds Image Generation

This is where the plugin becomes much more valuable than a normal inspiration board.

### Current path

1. Capture references
2. Analyze taste and design system
3. Summarize the library
4. Choose a branch direction
5. Generate a board or concept image

### Better path

1. Capture references with notes
2. Extract strong design-system readings
3. Synthesize stable preferences and tensions
4. Generate branch-specific prompts from:
   - typography logic
   - palette logic
   - imagery logic
   - layout tendencies
   - anti-patterns
5. Render image boards or concept comps

### Why this matters

Most image generation is too generic because the prompt only says something like:

- "clean modern SaaS website"

What we want instead is something closer to:

- "Create a warm-technical landing page board with editorial serif display typography, restrained sans UI text, deep navy and off-white surfaces, one acid-lime activation color, modular section rhythm, and subtle diagrammatic illustrations. Avoid glossy 3D startup visuals and purple-heavy gradients."

That is much more likely to produce usable output.

## Example End-to-End Flows

### Flow A: "I like this brand"

1. Capture `antimetal.com`
2. Add note: `The typography and dark/light rhythm feel exactly right`
3. Extract `typography`, `colors`, `imagery`
4. Summarize taste across similar references
5. Generate `infra-editorial`

**Result**
- a board that feels like your taste, not a random startup collage

### Flow B: "We need a design direction for our product"

1. Capture 8 references
2. Summarize the library
3. Generate 3 branch directions
4. Pick one
5. Expand it into a library-level `design.md`

**Result**
- a direction brief you can design and build against

### Flow C: "We want a designer-engineer handoff"

1. Capture the strongest references
2. Extract design system docs
3. Summarize into one library design system
4. Turn the resulting system into implementation prompts or tickets

**Result**
- fewer style misunderstandings and better fidelity

## Highest-Leverage Product Direction

The highest-leverage direction is probably:

- **Taste intake**
- **Design-system reading**
- **Library synthesis**
- **Branch generation**
- **Implementation handoff**

That creates one pipeline from inspiration to shipped design.

If this is done well, the plugin is not just a moodboard utility.

It becomes:

- a taste memory system
- a design research assistant
- a brand reading tool
- a direction generator
- a design-to-build handoff engine

## Suggested Next Additions

1. Comparative analysis between two saved references
2. Category-level synthesis from multiple competitor captures
3. Better prompt generation for image boards and UI comps
4. Implementation-facing token extraction for typography and color systems
5. A "generate landing page brief" output derived from the library design system
6. A "why this feels generic" mode for weak references or existing product pages
