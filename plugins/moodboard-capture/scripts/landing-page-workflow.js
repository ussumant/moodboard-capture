#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  getLibraryDesignPaths,
  loadCompleteDesignReferences,
} from './design-system.js';
import { summarizeTaste } from './taste-summary.js';

const defaultLibraryRoot = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');
const defaultDirectionIds = ['infra-editorial', 'warm-technical', 'strange-systems'];

/**
 * @typedef {Object} DesignDirection
 * @property {string} generatedAt
 * @property {string} id
 * @property {string} thesis
 * @property {string} overview
 * @property {{summary: string, recurringTokens: string[], usageNotes: string[]}} paletteSystem
 * @property {{summary: string, familyDirection: string[], hierarchyCues: string[], usagePrinciples: string[]}} typographySystem
 * @property {string[]} compositionRules
 * @property {string[]} componentPosture
 * @property {string[]} illustrationPosture
 * @property {{summary: string, principles: string[]}} ctaTone
 * @property {string[]} antiPatterns
 * @property {{recordId: string, sourceUrl: string|null, designSystemJsonPath: string|null, designMdPath: string|null, whySelected: string}[]} selectedSourceReferences
 * @property {string[]} confidenceNotes
 * @property {Object} supportingSignals
 */

/**
 * @typedef {Object} LandingPageBrief
 * @property {string} generatedAt
 * @property {string} directionId
 * @property {string} targetAudience
 * @property {string} productGoal
 * @property {string} pageThesis
 * @property {{headlineDirection: string, supportingCopyDirection: string, visualDirection: string, proofCue: string, ctaLabel: string}} heroDirection
 * @property {{display: string[], body: string[], usagePrinciples: string[]}} typographyPairing
 * @property {{foundation: string[], accents: string[], usagePrinciples: string[]}} colorSystem
 * @property {{primaryMotifs: string[], styleRules: string[], avoid: string[]}} illustrationSystem
 * @property {{primaryProof: string, artifactsToShow: string[], implementationNotes: string[]}} proofDemoStrategy
 * @property {{primaryAction: string, secondaryAction: string, placementNotes: string[]}} ctaStrategy
 * @property {{summary: string, behaviors: string[]}} interactionTone
 * @property {{id: string, title: string, purpose: string, layout: string, content: string[], proofSourceReferenceIds: string[]}}[] sectionPlan
 * @property {{id: string, purpose: string, promptFocus: string}}[] recommendedGeneratedImageTargets
 * @property {string[]} antiPatterns
 * @property {string[]} reviewCheckpoint
 * @property {string[]} sourceReferenceIds
 */

export function getDirectionDesignPaths({ libraryRoot, directionId }) {
  const designRoot = path.join(libraryRoot, 'design-docs', 'directions', directionId);
  return {
    designRoot,
    designSystemJsonPath: path.join(designRoot, 'design-system.json'),
    designMdPath: path.join(designRoot, 'design.md'),
  };
}

export function getLandingPageDocPaths({ libraryRoot }) {
  const docsRoot = path.join(libraryRoot, 'landing-page-docs');
  return {
    docsRoot,
    briefJsonPath: path.join(docsRoot, 'landing-page-brief.json'),
    briefMdPath: path.join(docsRoot, 'landing-page-brief.md'),
    provenancePath: path.join(docsRoot, 'provenance.json'),
  };
}

export async function deriveDesignDirections({
  destinationPath,
  referenceIds,
  directionCount,
}) {
  const libraryRoot = destinationPath
    ? path.resolve(destinationPath)
    : defaultLibraryRoot;
  const summaryResult = await summarizeTaste({
    destinationPath: libraryRoot,
  });
  const selectedDirectionIds = resolveDirectionIds(directionCount);
  const candidateReferences = filterDesignReferences({
    designReferences: summaryResult.designReferences,
    referenceIds,
  });

  if (candidateReferences.length === 0) {
    throw new Error('No extracted design references are available to derive landing-page directions.');
  }

  const directions = [];
  for (const directionId of selectedDirectionIds) {
    const branch = summaryResult.summary.branchDirections?.find((item) => item.id === directionId);
    if (!branch) {
      throw new Error(`Taste summary does not contain branch direction: ${directionId}`);
    }

    const selectedSources = selectSourceReferencesForDirection({
      directionId,
      branch,
      designReferences: candidateReferences,
    });
    const direction = buildDesignDirection({
      directionId,
      branch,
      selectedSources,
      summary: summaryResult.summary,
      libraryDesignSystem: summaryResult.libraryDesignSystem,
    });
    const paths = await writeDirectionArtifacts({
      libraryRoot,
      direction,
    });

    directions.push({
      id: direction.id,
      thesis: direction.thesis,
      designSystemJsonPath: paths.designSystemJsonPath,
      designMdPath: paths.designMdPath,
      sourceRecordIds: direction.selectedSourceReferences.map((item) => item.recordId),
      confidenceNotes: direction.confidenceNotes,
    });
  }

  return {
    libraryRoot,
    summaryPath: summaryResult.summaryPath,
    libraryDesignSystemPath: summaryResult.libraryDesignSystemPath,
    directionCount: selectedDirectionIds.length,
    directions,
  };
}

export async function planLandingPage({
  destinationPath,
  directionId,
  referenceIds,
  targetAudience,
  productGoal,
}) {
  if (!directionId || typeof directionId !== 'string') {
    throw new Error('A non-empty directionId is required.');
  }

  const normalizedDirectionId = directionId.trim().toLowerCase();
  if (!defaultDirectionIds.includes(normalizedDirectionId)) {
    throw new Error(`Unsupported directionId: ${directionId}`);
  }

  const libraryRoot = destinationPath
    ? path.resolve(destinationPath)
    : defaultLibraryRoot;
  const summaryResult = await summarizeTaste({
    destinationPath: libraryRoot,
  });

  const directionPaths = getDirectionDesignPaths({
    libraryRoot,
    directionId: normalizedDirectionId,
  });

  const hasScopedReferences = Array.isArray(referenceIds) && referenceIds.some((item) => typeof item === 'string' && item.trim());
  if (!await fileExists(directionPaths.designSystemJsonPath) || hasScopedReferences) {
    await deriveDesignDirections({
      destinationPath: libraryRoot,
      referenceIds,
      directionCount: 3,
    });
  }

  const direction = await readJson(directionPaths.designSystemJsonPath);
  const brief = buildLandingPageBrief({
    direction,
    summary: summaryResult.summary,
    libraryDesignSystem: summaryResult.libraryDesignSystem,
    targetAudience,
    productGoal,
  });
  const provenance = buildLandingPageProvenance({
    brief,
    direction,
    summaryPath: summaryResult.summaryPath,
    libraryDesignSystemPath: summaryResult.libraryDesignSystemPath,
    directionArtifactPath: directionPaths.designSystemJsonPath,
  });
  const writtenPaths = await writeLandingPageArtifacts({
    libraryRoot,
    brief,
    provenance,
  });

  return {
    libraryRoot,
    directionId: normalizedDirectionId,
    summaryPath: summaryResult.summaryPath,
    libraryDesignSystemPath: summaryResult.libraryDesignSystemPath,
    landingPageBriefPath: writtenPaths.briefJsonPath,
    landingPageBriefMdPath: writtenPaths.briefMdPath,
    provenancePath: writtenPaths.provenancePath,
    sourceReferenceIds: brief.sourceReferenceIds,
    reviewCheckpoint: brief.reviewCheckpoint,
  };
}

function buildDesignDirection({
  directionId,
  branch,
  selectedSources,
  summary,
  libraryDesignSystem,
}) {
  const paletteTokens = uniqueStrings(selectedSources.flatMap((item) => item.extraction.colors?.brandTokens?.map((token) => `${token.name}: ${token.role}`) || []));
  const surfaceTokens = uniqueStrings(selectedSources.flatMap((item) => item.extraction.colors?.surfaceTokens?.map((token) => `${token.name}: ${token.role}`) || []));
  const familyDirection = uniqueStrings(selectedSources.flatMap((item) => item.extraction.typography?.fontFamilies?.map((family) => `${family.name}: ${family.role}`) || []));
  const hierarchyCues = uniqueStrings(selectedSources.flatMap((item) => item.extraction.typography?.principles || []));
  const compositionRules = uniqueStrings([
    ...branch.compositionNotes,
    ...selectedSources.flatMap((item) => [
      ...(item.extraction.layout?.spacingSystem || []),
      ...(item.extraction.layout?.gridNotes || []),
      ...(item.extraction.layout?.responsiveStrategy || []),
    ]),
  ]).slice(0, 8);
  const componentPosture = uniqueStrings(selectedSources.flatMap((item) =>
    (item.extraction.components || []).map((component) =>
      `${component.name}: ${component.properties.slice(0, 2).join(', ') || component.description}`
    )
  )).slice(0, 8);
  const illustrationPosture = uniqueStrings([
    ...branch.imageryNotes,
    ...selectedSources.flatMap((item) => [
      ...(item.extraction.imageryIllustration?.styles || []),
      ...(item.extraction.imageryIllustration?.behaviors || []),
    ]),
  ]).slice(0, 8);
  const antiPatterns = uniqueStrings([
    ...branch.avoidNotes,
    ...selectedSources.flatMap((item) => item.extraction.donts || []),
    ...summary.antiPatterns,
  ]).slice(0, 10);
  const ctaPrinciples = buildCtaPrinciples({
    directionId,
    branch,
    summary,
  });

  /** @type {DesignDirection} */
  return {
    generatedAt: new Date().toISOString(),
    id: directionId,
    thesis: branch.thesis,
    overview: buildDirectionOverview({
      directionId,
      branch,
      selectedSources,
      summary,
    }),
    paletteSystem: {
      summary: `This direction uses ${joinList(branch.paletteNotes, 'controlled contrast')} to create a distinct landing-page palette without drifting into generic SaaS color defaults.`,
      recurringTokens: uniqueStrings([
        ...branch.paletteNotes,
        ...paletteTokens,
        ...surfaceTokens,
        ...(libraryDesignSystem.colors?.recurringTokens || []),
      ]).slice(0, 10),
      usageNotes: uniqueStrings([
        'Reserve the strongest accent for primary CTA moments and tiny moments of emphasis.',
        'Keep long content bands calmer than the hero so proof sections read clearly.',
        ...(selectedSources.flatMap((item) => item.extraction.colors?.gradientNotes || [])),
      ]).slice(0, 6),
    },
    typographySystem: {
      summary: `Typography should express ${joinList(branch.typographyNotes, 'clear hierarchy')} while staying implementation-friendly and highly readable.`,
      familyDirection: familyDirection.slice(0, 8),
      hierarchyCues: uniqueStrings([
        ...branch.typographyNotes,
        ...hierarchyCues,
      ]).slice(0, 8),
      usagePrinciples: uniqueStrings([
        'Use display type to create point of view, and keep body/UI typography neutral enough to support proof.',
        'Preserve contrast between headline voice and explanatory copy.',
        ...selectedSources.flatMap((item) => item.extraction.typography?.principles || []),
      ]).slice(0, 6),
    },
    compositionRules,
    componentPosture,
    illustrationPosture,
    ctaTone: {
      summary: ctaPrinciples[0],
      principles: ctaPrinciples,
    },
    antiPatterns,
    selectedSourceReferences: selectedSources.map((item) => ({
      recordId: item.record.id,
      sourceUrl: item.record.sourceUrl || null,
      designSystemJsonPath: item.record.designSystemJsonPath || null,
      designMdPath: item.record.designMdPath || null,
      whySelected: item.whySelected,
    })),
    confidenceNotes: [
      `Grounded in ${selectedSources.length} extracted reference${selectedSources.length === 1 ? '' : 's'}.`,
      'Built from per-reference design-system JSON plus the active taste summary.',
      'Motion and interaction guidance remain lower-confidence unless directly supported by user notes or live-site evidence.',
    ],
    supportingSignals: {
      stablePreferences: summary.stablePreferences,
      tensions: summary.tensions,
      paletteNotes: branch.paletteNotes,
      typographyNotes: branch.typographyNotes,
      compositionNotes: branch.compositionNotes,
      imageryNotes: branch.imageryNotes,
    },
  };
}

function buildLandingPageBrief({
  direction,
  summary,
  libraryDesignSystem,
  targetAudience,
  productGoal,
}) {
  const audience = normalizeText(targetAudience) || 'Design-minded builders evaluating whether this workflow is real, credible, and worth trying.';
  const goal = normalizeText(productGoal) || 'Convert the chosen taste direction into a landing page that explains the workflow clearly and proves it can generate implementation-ready design direction.';
  const sourceReferenceIds = direction.selectedSourceReferences.map((item) => item.recordId);
  const accentLead = direction.paletteSystem.recurringTokens[0] || direction.paletteSystem.summary;
  const displayLead = direction.typographySystem.familyDirection[0] || direction.typographySystem.summary;
  const illustrationLead = direction.illustrationPosture[0] || 'system-aware illustration';

  /** @type {LandingPageBrief} */
  return {
    generatedAt: new Date().toISOString(),
    directionId: direction.id,
    targetAudience: audience,
    productGoal: goal,
    pageThesis: `${direction.thesis} The page should prove that references can become reusable design direction, not just an archive.`,
    heroDirection: {
      headlineDirection: buildHeroHeadlineDirection(direction),
      supportingCopyDirection: 'Explain the workflow in one compact paragraph using concrete outputs, not abstract design-language promises.',
      visualDirection: `Lead with ${illustrationLead} and ${accentLead} so the first screen already feels like a point of view, not a generic plugin page.`,
      proofCue: 'Show one reference-to-output transformation immediately below the hero so trust starts before long-form explanation.',
      ctaLabel: 'Install plugin',
    },
    typographyPairing: {
      display: direction.typographySystem.familyDirection.slice(0, 3),
      body: uniqueStrings([
        'Keep body and UI copy calmer than display type.',
        ...direction.typographySystem.hierarchyCues.slice(0, 3),
      ]),
      usagePrinciples: direction.typographySystem.usagePrinciples.slice(0, 6),
    },
    colorSystem: {
      foundation: direction.paletteSystem.recurringTokens.slice(0, 6),
      accents: direction.paletteSystem.usageNotes.slice(0, 4),
      usagePrinciples: [
        'Let the hero carry the strongest contrast and the body sections carry proof and readability.',
        'Keep CTA accents rare enough that install actions feel intentional.',
        ...direction.paletteSystem.usageNotes.slice(0, 2),
      ].slice(0, 6),
    },
    illustrationSystem: {
      primaryMotifs: direction.illustrationPosture.slice(0, 5),
      styleRules: [
        'Use illustrations to reinforce the system story, not to decorate empty space.',
        'Motifs should visibly connect back to captured references or extracted design signals.',
        'Generated imagery should stay modular enough to support implementation in sections, cards, and hero.',
      ],
      avoid: direction.antiPatterns.slice(0, 5),
    },
    proofDemoStrategy: {
      primaryProof: 'Use one real saved reference, one extracted design-system block, one summarized taste block, and one generated direction panel.',
      artifactsToShow: [
        'Captured reference screenshot',
        'Per-reference design.md / design-system.json cues',
        'Taste summary with tensions and anti-patterns',
        'Direction boards or hero-illustration explorations',
      ],
      implementationNotes: [
        'Each proof block should be traceable to a real artifact path or output name.',
        'Avoid invented metrics or generic testimonials unless they are clearly labeled as placeholders.',
        'Keep the install flow visible before long-form narrative sections.',
      ],
    },
    ctaStrategy: {
      primaryAction: 'Install plugin',
      secondaryAction: 'View the repo',
      placementNotes: [
        'Primary install CTA in header, hero, and closing section.',
        'Secondary repo CTA can sit beside install, but should never outrank it.',
        'Show the actual Codex install command in the install section, not only prose.',
      ],
    },
    interactionTone: {
      summary: 'Interactions should feel precise, calm, and confident rather than flashy.',
      behaviors: [
        'Use subtle hover/press feedback rather than decorative motion.',
        'Let copy-to-clipboard and anchor-jump moments feel immediate and frictionless.',
        'Keep mobile behavior orientation-friendly so install and proof never get buried.',
      ],
    },
    sectionPlan: buildSectionPlan({
      direction,
      summary,
      audience,
      goal,
      sourceReferenceIds,
    }),
    recommendedGeneratedImageTargets: buildGeneratedImageTargets(direction),
    antiPatterns: direction.antiPatterns.slice(0, 8),
    reviewCheckpoint: [
      'Does the hero immediately express the chosen direction and the real product outcome?',
      'Does the page prove install, workflow, and outputs with concrete artifacts instead of generic claims?',
      'Are the visuals clearly grounded in the selected references and extracted design signals?',
      'Would a separate frontend agent know what to build section by section without inventing the design system?',
    ],
    sourceReferenceIds,
  };
}

function buildLandingPageProvenance({
  brief,
  direction,
  summaryPath,
  libraryDesignSystemPath,
  directionArtifactPath,
}) {
  return {
    generatedAt: new Date().toISOString(),
    directionId: direction.id,
    summaryPath,
    libraryDesignSystemPath,
    directionArtifactPath,
    selectedSourceReferences: direction.selectedSourceReferences,
    decisions: {
      heroDirection: {
        rationale: brief.heroDirection.visualDirection,
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.imageryNotes,
        directionSignals: direction.illustrationPosture,
      },
      typographyPairing: {
        rationale: brief.typographyPairing.usagePrinciples[0],
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.typographyNotes,
        directionSignals: direction.typographySystem.familyDirection,
      },
      colorSystem: {
        rationale: brief.colorSystem.usagePrinciples[0],
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.paletteNotes,
        directionSignals: direction.paletteSystem.recurringTokens,
      },
      proofDemoStrategy: {
        rationale: brief.proofDemoStrategy.primaryProof,
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: brief.sourceReferenceIds,
        directionSignals: direction.componentPosture,
      },
      sectionPlan: {
        rationale: 'Section ordering is derived from the direction thesis plus the need to prove capture -> extraction -> synthesis -> generation.',
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.stablePreferences,
        directionSignals: brief.sectionPlan.map((section) => `${section.id}: ${section.purpose}`),
      },
      antiPatterns: {
        rationale: 'Avoid patterns surfaced repeatedly in the chosen taste direction and library summary.',
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.tensions,
        directionSignals: brief.antiPatterns,
      },
      generatedImageTargets: {
        rationale: 'ImageGen should be used only where it sharpens visual branching or motif exploration.',
        sourceRecordIds: brief.sourceReferenceIds,
        summarySignals: direction.supportingSignals.imageryNotes,
        directionSignals: brief.recommendedGeneratedImageTargets.map((item) => `${item.id}: ${item.promptFocus}`),
      },
    },
  };
}

async function writeDirectionArtifacts({ libraryRoot, direction }) {
  const paths = getDirectionDesignPaths({
    libraryRoot,
    directionId: direction.id,
  });

  await fs.mkdir(paths.designRoot, { recursive: true });
  await fs.writeFile(
    paths.designSystemJsonPath,
    `${JSON.stringify(direction, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    paths.designMdPath,
    `${renderDirectionMarkdown(direction)}\n`,
    'utf8'
  );

  return paths;
}

async function writeLandingPageArtifacts({ libraryRoot, brief, provenance }) {
  const paths = getLandingPageDocPaths({ libraryRoot });
  await fs.mkdir(paths.docsRoot, { recursive: true });
  await fs.writeFile(paths.briefJsonPath, `${JSON.stringify(brief, null, 2)}\n`, 'utf8');
  await fs.writeFile(paths.briefMdPath, `${renderLandingPageBriefMarkdown(brief)}\n`, 'utf8');
  await fs.writeFile(paths.provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
  return paths;
}

function filterDesignReferences({ designReferences, referenceIds }) {
  if (!Array.isArray(referenceIds) || referenceIds.length === 0) {
    return Array.isArray(designReferences) ? designReferences : [];
  }

  const normalizedIds = referenceIds
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  return (Array.isArray(designReferences) ? designReferences : []).filter((item) =>
    normalizedIds.includes(item.record.id)
  );
}

function resolveDirectionIds(directionCount) {
  if (directionCount == null) {
    return [...defaultDirectionIds];
  }

  const normalized = Number(directionCount);
  if (!Number.isInteger(normalized) || ![2, 3].includes(normalized)) {
    throw new Error('directionCount must be 2 or 3 when provided.');
  }

  return defaultDirectionIds.slice(0, normalized);
}

function selectSourceReferencesForDirection({
  directionId,
  branch,
  designReferences,
}) {
  const scored = designReferences.map((item) => ({
    item,
    ...scoreReferenceForDirection({
      directionId,
      branch,
      reference: item,
    }),
  }));

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.item.record.id.localeCompare(right.item.record.id);
  });

  const topMatches = scored.slice(0, Math.min(3, Math.max(2, designReferences.length)));
  return topMatches.map((match) => ({
    ...match.item,
    whySelected: match.whySelected,
  }));
}

function scoreReferenceForDirection({ directionId, branch, reference }) {
  const corpus = buildReferenceCorpus(reference).toLowerCase();
  const matchedReasons = [];
  let score = 0;

  const directionKeywords = {
    'infra-editorial': ['network', 'gradient', 'contrast', 'technical', 'developer', 'data', 'system', 'trustworthy', 'monospace', 'globe'],
    'warm-technical': ['warm', 'beige', 'paper', 'friendly', 'organic', 'human', 'illustration', 'approachable', 'textured'],
    'strange-systems': ['pixel', 'glitch', 'nostalgic', 'conceptual', 'abstract', 'experimental', 'playful', 'memorable'],
  };

  for (const keyword of directionKeywords[directionId] || []) {
    if (corpus.includes(keyword)) {
      score += 2;
      matchedReasons.push(`Matched ${keyword}`);
    }
  }

  for (const note of uniqueStrings([
    ...branch.paletteNotes,
    ...branch.typographyNotes,
    ...branch.compositionNotes,
    ...branch.imageryNotes,
  ])) {
    for (const fragment of splitKeywords(note)) {
      if (fragment.length < 4) {
        continue;
      }
      if (corpus.includes(fragment)) {
        score += 1;
        matchedReasons.push(`Aligned with ${fragment}`);
      }
    }
  }

  if (score === 0) {
    matchedReasons.push('Used as a balancing reference because it broadens the direction evidence set.');
  }

  return {
    score,
    whySelected: uniqueStrings(matchedReasons).slice(0, 3).join('; '),
  };
}

function buildDirectionOverview({ directionId, branch, selectedSources, summary }) {
  const sourceLead = selectedSources
    .map((item) => item.record.sourceUrl || item.record.id)
    .slice(0, 2)
    .join(', ');

  return `${branch.thesis} This direction is grounded in ${sourceLead || 'the active reference set'} and keeps the broader taste tensions in view: ${joinList(summary.tensions, 'clarity vs distinctiveness')}.`;
}

function buildCtaPrinciples({ directionId, branch, summary }) {
  const firstLineByDirection = {
    'infra-editorial': 'CTA treatment should feel decisive and high-contrast, as if the product already knows what the next action is.',
    'warm-technical': 'CTA treatment should feel inviting and helpful without losing technical conviction.',
    'strange-systems': 'CTA treatment should feel clear first, with just enough novelty to make the interaction memorable.',
  };

  return uniqueStrings([
    firstLineByDirection[directionId] || 'CTA treatment should feel purposeful and easy to trust.',
    `Keep CTA tone aligned with the broader thesis: ${branch.thesis}`,
    `Do not drift into the known anti-patterns: ${joinList(summary.antiPatterns.slice(0, 3), 'generic clutter')}.`,
  ]).slice(0, 4);
}

function buildHeroHeadlineDirection(direction) {
  const byDirection = {
    'infra-editorial': 'Lead with a sharp, high-conviction statement that makes the workflow sound inevitable rather than optional.',
    'warm-technical': 'Lead with a confident but humane statement that makes the workflow feel useful before it feels clever.',
    'strange-systems': 'Lead with a line that feels precise and slightly uncanny, but never vague or theatrical.',
  };

  return byDirection[direction.id] || 'Lead with a concise statement of what the workflow unlocks.';
}

function buildSectionPlan({
  direction,
  summary,
  audience,
  goal,
  sourceReferenceIds,
}) {
  return [
    {
      id: 'hero',
      title: 'Hero',
      purpose: 'State the product promise and let the chosen direction establish trust immediately.',
      layout: 'Two-column or weighted split hero with one dominant visual system and one install-forward CTA cluster.',
      content: [
        direction.thesis,
        `Audience framing: ${audience}`,
        'Primary CTA: install plugin',
        'Secondary CTA: view repo or example artifacts',
      ],
      proofSourceReferenceIds: sourceReferenceIds.slice(0, 2),
    },
    {
      id: 'credibility-strip',
      title: 'Workflow proof strip',
      purpose: 'Show the smallest believable proof that the workflow is real.',
      layout: 'Four compact columns or cards showing capture, extraction, summary, and generation.',
      content: [
        'Reference capture',
        'Per-reference design system extraction',
        'Taste synthesis',
        'Generated direction output',
      ],
      proofSourceReferenceIds: sourceReferenceIds,
    },
    {
      id: 'process',
      title: 'How it works',
      purpose: 'Explain the sequence from references to reusable direction with low cognitive load.',
      layout: 'Numbered step row followed by one richer artifact comparison area.',
      content: [
        'capture_taste',
        'extract_design_system',
        'summarize_taste',
        'derive_design_directions',
        'plan_landing_page',
      ],
      proofSourceReferenceIds: sourceReferenceIds,
    },
    {
      id: 'install-and-artifacts',
      title: 'Install and artifacts',
      purpose: 'Make installation frictionless while proving what lands on disk.',
      layout: 'Split layout with install narrative on one side and terminal/artifact panel on the other.',
      content: [
        'Actual Codex install command',
        'One natural-language usage example',
        'Artifact paths for design docs, summaries, and direction files',
      ],
      proofSourceReferenceIds: sourceReferenceIds.slice(0, 1),
    },
    {
      id: 'implementation-readiness',
      title: 'Implementation readiness',
      purpose: 'Prove the workflow creates enough structure for a frontend engineer or agent to build from.',
      layout: 'Dense but readable card grid or annotated panel.',
      content: [
        `Product goal: ${goal}`,
        `Stable preferences: ${joinList(summary.stablePreferences.slice(0, 4), 'clarity and trust')}`,
        `Tensions: ${joinList(summary.tensions.slice(0, 2), 'rigor and warmth')}`,
        `Avoid: ${joinList(direction.antiPatterns.slice(0, 4), 'generic clutter')}`,
      ],
      proofSourceReferenceIds: sourceReferenceIds,
    },
    {
      id: 'closing-cta',
      title: 'Closing CTA',
      purpose: 'End with one clear next action and the same visual conviction as the hero.',
      layout: 'Full-width contrast section with one primary CTA and one secondary repo action.',
      content: [
        'Repeat install action',
        'Reinforce the workflow promise',
        'Keep the page ending simple and high-confidence',
      ],
      proofSourceReferenceIds: sourceReferenceIds.slice(0, 1),
    },
  ];
}

function buildGeneratedImageTargets(direction) {
  return [
    {
      id: 'hero-illustration',
      purpose: 'Give the landing page an unmistakable first-screen visual system.',
      promptFocus: `Translate ${direction.id} into one hero-scale visual system using ${joinList(direction.illustrationPosture.slice(0, 3), 'system-aware illustration')} and ${joinList(direction.paletteSystem.recurringTokens.slice(0, 3), 'controlled contrast')}.`,
    },
    {
      id: 'system-panel',
      purpose: 'Support the design-system or implementation-readiness section with a modular visual panel.',
      promptFocus: `Create a smaller system illustration that expresses ${joinList(direction.componentPosture.slice(0, 3), 'structured content blocks')} without becoming a fake product screenshot.`,
    },
    {
      id: 'section-divider-board',
      purpose: 'Explore a motif or texture family that can recur lightly between sections.',
      promptFocus: `Generate a restrained motif family based on ${joinList(direction.supportingSignals.imageryNotes, 'abstract system cues')} and avoid ${joinList(direction.antiPatterns.slice(0, 3), 'generic SaaS defaults')}.`,
    },
  ];
}

function renderDirectionMarkdown(direction) {
  const lines = [
    `# ${direction.id}`,
    '',
    '## Thesis',
    '',
    direction.thesis,
    '',
    '## Overview',
    '',
    direction.overview,
    '',
    '## Palette System',
    '',
    direction.paletteSystem.summary,
    '',
    ...renderBulletBlock('Recurring Tokens', direction.paletteSystem.recurringTokens),
    ...renderBulletBlock('Usage Notes', direction.paletteSystem.usageNotes),
    '## Typography System',
    '',
    direction.typographySystem.summary,
    '',
    ...renderBulletBlock('Family Direction', direction.typographySystem.familyDirection),
    ...renderBulletBlock('Hierarchy Cues', direction.typographySystem.hierarchyCues),
    ...renderBulletBlock('Usage Principles', direction.typographySystem.usagePrinciples),
    '## Composition Rules',
    '',
    ...renderBulletList(direction.compositionRules),
    '',
    '## Component Posture',
    '',
    ...renderBulletList(direction.componentPosture),
    '',
    '## Illustration Posture',
    '',
    ...renderBulletList(direction.illustrationPosture),
    '',
    '## CTA Tone',
    '',
    direction.ctaTone.summary,
    '',
    ...renderBulletList(direction.ctaTone.principles),
    '',
    '## Anti-Patterns',
    '',
    ...renderBulletList(direction.antiPatterns),
    '',
    '## Selected Source References',
    '',
    ...direction.selectedSourceReferences.flatMap((item) => [
      `- ${item.recordId}${item.sourceUrl ? ` — ${item.sourceUrl}` : ''}`,
      `Why selected: ${item.whySelected}`,
    ]),
    '',
    '## Confidence Notes',
    '',
    ...renderBulletList(direction.confidenceNotes),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function renderLandingPageBriefMarkdown(brief) {
  const lines = [
    '# Landing Page Brief',
    '',
    '## Summary',
    '',
    `Direction: ${brief.directionId}`,
    '',
    `Audience: ${brief.targetAudience}`,
    '',
    `Goal: ${brief.productGoal}`,
    '',
    `Page thesis: ${brief.pageThesis}`,
    '',
    '## Hero Direction',
    '',
    `- Headline: ${brief.heroDirection.headlineDirection}`,
    `- Supporting copy: ${brief.heroDirection.supportingCopyDirection}`,
    `- Visual: ${brief.heroDirection.visualDirection}`,
    `- Proof cue: ${brief.heroDirection.proofCue}`,
    `- CTA: ${brief.heroDirection.ctaLabel}`,
    '',
    '## System Choices',
    '',
    ...renderBulletBlock('Typography Pairing', [
      ...brief.typographyPairing.display,
      ...brief.typographyPairing.body,
      ...brief.typographyPairing.usagePrinciples,
    ]),
    ...renderBulletBlock('Color System', [
      ...brief.colorSystem.foundation,
      ...brief.colorSystem.accents,
      ...brief.colorSystem.usagePrinciples,
    ]),
    ...renderBulletBlock('Illustration System', [
      ...brief.illustrationSystem.primaryMotifs,
      ...brief.illustrationSystem.styleRules,
      ...brief.illustrationSystem.avoid,
    ]),
    '## Section Plan',
    '',
    ...brief.sectionPlan.flatMap((section) => [
      `### ${section.title}`,
      '',
      `Purpose: ${section.purpose}`,
      '',
      `Layout: ${section.layout}`,
      '',
      ...renderBulletList(section.content),
      '',
    ]),
    '## Proof and CTA Strategy',
    '',
    `Primary proof: ${brief.proofDemoStrategy.primaryProof}`,
    '',
    ...renderBulletBlock('Artifacts To Show', brief.proofDemoStrategy.artifactsToShow),
    ...renderBulletBlock('Implementation Notes', brief.proofDemoStrategy.implementationNotes),
    ...renderBulletBlock('CTA Strategy', [
      `Primary action: ${brief.ctaStrategy.primaryAction}`,
      `Secondary action: ${brief.ctaStrategy.secondaryAction}`,
      ...brief.ctaStrategy.placementNotes,
    ]),
    '## Recommended Image Targets',
    '',
    ...brief.recommendedGeneratedImageTargets.flatMap((item) => [
      `- ${item.id}: ${item.purpose}`,
      `Prompt focus: ${item.promptFocus}`,
    ]),
    '',
    '## Anti-Patterns',
    '',
    ...renderBulletList(brief.antiPatterns),
    '',
    '## Review Checkpoint',
    '',
    ...renderBulletList(brief.reviewCheckpoint),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function renderBulletBlock(title, items) {
  return [
    `### ${title}`,
    '',
    ...renderBulletList(items),
    '',
  ];
}

function renderBulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ['- None recorded yet.'];
  }
  return items.map((item) => `- ${item}`);
}

function buildReferenceCorpus(reference) {
  return [
    reference.record.sourceUrl || '',
    reference.record.whyItWorks || '',
    reference.record.userNote || '',
    ...(reference.record.tags || []),
    ...(reference.record.styleCues || []),
    reference.extraction.overview || '',
    ...(reference.extraction.keyCharacteristics || []),
    reference.extraction.colors?.summary || '',
    ...(reference.extraction.colors?.gradientNotes || []),
    reference.extraction.typography?.summary || '',
    ...(reference.extraction.typography?.principles || []),
    reference.extraction.layout?.summary || '',
    ...(reference.extraction.layout?.gridNotes || []),
    ...(reference.extraction.layout?.spacingSystem || []),
    ...(reference.extraction.imageryIllustration?.styles || []),
    ...(reference.extraction.imageryIllustration?.behaviors || []),
    ...(reference.extraction.motionInteraction?.patterns || []),
    ...(reference.extraction.components || []).map((component) => `${component.name} ${component.description} ${(component.properties || []).join(' ')}`),
  ].join(' ');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function joinList(values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  return values.slice(0, 6).join(', ');
}

function splitKeywords(value) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values) {
  const normalized = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }
    normalized.push(trimmed);
  }
  return normalized;
}
