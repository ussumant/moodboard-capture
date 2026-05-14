#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { getLibraryDesignPaths } from './design-system.js';
import { getDirectionDesignPaths } from './landing-page-workflow.js';
import { summarizeTaste } from './taste-summary.js';

const defaultImageModel = 'gpt-image-1';
const defaultImageSize = '1536x1024';
const defaultImageQuality = 'medium';
const defaultDirections = ['infra-editorial', 'warm-technical', 'strange-systems'];
const defaultLibraryRoot = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');
const visualModeValues = new Set(['auto', 'mock']);

export async function visualizeTaste({
  destinationPath,
  summaryPath,
  directions,
}) {
  const libraryRoot = destinationPath
    ? path.resolve(destinationPath)
    : defaultLibraryRoot;
  const resolvedSummaryPath = summaryPath
    ? path.resolve(summaryPath)
    : path.join(libraryRoot, 'taste-summary.json');
  const selectedDirections = normalizeDirections(directions);
  const visualMode = resolveVisualMode();
  const tasteContext = await ensureTasteContext({
    libraryRoot,
    summaryPath: resolvedSummaryPath,
    directions: selectedDirections,
  });
  const visualsRoot = tasteContext.hasDirectionArtifacts
    ? path.join(libraryRoot, 'taste-boards', 'landing-page')
    : path.join(libraryRoot, 'taste-boards');

  await fs.mkdir(visualsRoot, { recursive: true });

  const promptSet = selectedDirections.map((direction) => ({
    direction,
    prompt: buildTasteVisualPrompt({
      direction,
      summary: tasteContext.summary,
      libraryDesignSystem: tasteContext.libraryDesignSystem,
      directionArtifact: tasteContext.directionArtifacts[direction]?.designSystem || null,
    }),
  }));

  if (visualMode === 'mock') {
    const mockResults = [];
    for (const item of promptSet) {
      const outPath = path.join(visualsRoot, `${buildTimestamp(new Date())}-${item.direction}-prompt.json`);
      await fs.writeFile(
        outPath,
        `${JSON.stringify({
          direction: item.direction,
          prompt: item.prompt,
          mode: 'mock',
          summaryPath: tasteContext.summaryPath,
          libraryDesignSystemPath: tasteContext.libraryDesignSystemPath,
          directionDesignSystemPath: tasteContext.directionArtifacts[item.direction]?.designSystemJsonPath || null,
        }, null, 2)}\n`,
        'utf8'
      );
      mockResults.push({
        direction: item.direction,
        savedPath: outPath,
        prompt: item.prompt,
        mode: 'mock',
      });
    }

    return {
      libraryRoot,
      summaryPath: tasteContext.summaryPath,
      libraryDesignSystemPath: tasteContext.libraryDesignSystemPath,
      directionArtifactPaths: mapDirectionArtifactPaths(tasteContext.directionArtifacts),
      directions: selectedDirections,
      visualsRoot,
      mode: 'mock',
      outputs: mockResults,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate taste visual boards from the plugin.');
  }

  const outputs = [];
  for (const item of promptSet) {
    const generatedImage = await generateImage({
      apiKey,
      prompt: item.prompt,
    });
    const savedPath = path.join(visualsRoot, `${buildTimestamp(new Date())}-${item.direction}.png`);
    await fs.writeFile(savedPath, generatedImage, 'base64');
    outputs.push({
      direction: item.direction,
      savedPath,
      prompt: item.prompt,
      directionDesignSystemPath: tasteContext.directionArtifacts[item.direction]?.designSystemJsonPath || null,
      mode: 'generated',
    });
  }

  return {
    libraryRoot,
    summaryPath: tasteContext.summaryPath,
    libraryDesignSystemPath: tasteContext.libraryDesignSystemPath,
    directionArtifactPaths: mapDirectionArtifactPaths(tasteContext.directionArtifacts),
    directions: selectedDirections,
    visualsRoot,
    mode: 'generated',
    outputs,
  };
}

export async function generateTasteVisuals(args) {
  if (args.summaryPath) {
    return visualizeTaste({
      destinationPath: args.destinationPath,
      summaryPath: args.summaryPath,
      directions: args.directions,
    });
  }

  if (args.profilePath) {
    const libraryRoot = args.destinationPath
      ? path.resolve(args.destinationPath)
      : defaultLibraryRoot;
    const summaryResult = await summarizeTaste({
      destinationPath: libraryRoot,
      profilePath: args.profilePath,
    });
    return visualizeTaste({
      destinationPath: libraryRoot,
      summaryPath: summaryResult.summaryPath,
      directions: args.directions,
    });
  }

  return visualizeTaste({
    destinationPath: args.destinationPath,
    summaryPath: args.summaryPath,
    directions: args.directions,
  });
}

async function ensureTasteContext({ libraryRoot, summaryPath, directions }) {
  const designPaths = getLibraryDesignPaths({ libraryRoot });
  const hasSummary = await fileExists(summaryPath);
  const hasLibraryDesign = await fileExists(designPaths.designSystemJsonPath);
  const resolvedDirectionArtifacts = await loadDirectionArtifacts({
    libraryRoot,
    directions,
  });

  if (hasSummary && hasLibraryDesign) {
    return {
      summaryPath,
      summary: await readJson(summaryPath),
      libraryDesignSystemPath: designPaths.designSystemJsonPath,
      libraryDesignSystem: await readJson(designPaths.designSystemJsonPath),
      directionArtifacts: resolvedDirectionArtifacts,
      hasDirectionArtifacts: Object.keys(resolvedDirectionArtifacts).length > 0,
    };
  }

  const summaryResult = await summarizeTaste({
    destinationPath: libraryRoot,
  });

  return {
    summaryPath: summaryResult.summaryPath,
    summary: summaryResult.summary,
    libraryDesignSystemPath: summaryResult.libraryDesignSystemPath,
    libraryDesignSystem: summaryResult.libraryDesignSystem,
    directionArtifacts: resolvedDirectionArtifacts,
    hasDirectionArtifacts: Object.keys(resolvedDirectionArtifacts).length > 0,
  };
}

async function loadDirectionArtifacts({ libraryRoot, directions }) {
  const artifacts = {};

  for (const direction of directions || []) {
    const paths = getDirectionDesignPaths({ libraryRoot, directionId: direction });
    if (!await fileExists(paths.designSystemJsonPath)) {
      continue;
    }

    artifacts[direction] = {
      designSystemJsonPath: paths.designSystemJsonPath,
      designMdPath: paths.designMdPath,
      designSystem: await readJson(paths.designSystemJsonPath),
    };
  }

  return artifacts;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Summary file is not valid JSON: ${filePath}`);
  }
}

function normalizeDirections(directions) {
  if (!directions) {
    return defaultDirections;
  }

  const input = Array.isArray(directions) ? directions : [directions];
  const normalized = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim().toLowerCase();
    if (!trimmed) {
      continue;
    }
    if (!defaultDirections.includes(trimmed)) {
      throw new Error(`Unsupported visual direction: ${trimmed}`);
    }
    if (!normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  }

  return normalized.length > 0 ? normalized : defaultDirections;
}

function resolveVisualMode() {
  const requested = (process.env.MOODBOARD_CAPTURE_VISUAL_MODE || 'auto').toLowerCase();
  return visualModeValues.has(requested) ? requested : 'auto';
}

async function generateImage({ apiKey, prompt }) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.MOODBOARD_CAPTURE_IMAGE_MODEL || defaultImageModel,
      prompt,
      size: process.env.MOODBOARD_CAPTURE_IMAGE_SIZE || defaultImageSize,
      quality: process.env.MOODBOARD_CAPTURE_IMAGE_QUALITY || defaultImageQuality,
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation request failed (${response.status}): ${truncate(errorText, 300)}`);
  }

  const payload = await response.json();
  const base64Image = payload?.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error('Image generation response did not include image data.');
  }

  return base64Image;
}

function buildTasteVisualPrompt({ direction, summary, libraryDesignSystem, directionArtifact }) {
  const branch = summary.branchDirections?.find((item) => item.id === direction);
  if (!branch) {
    throw new Error(`Taste summary does not contain branch direction: ${direction}`);
  }

  const sharedLines = [
    'Create a single premium editorial moodboard image that expresses this structured software product-design taste summary.',
    `Stable preferences: ${joinList(summary.stablePreferences)}.`,
    `Anti-patterns: ${joinList(summary.antiPatterns)}.`,
    `Tensions: ${joinList(summary.tensions)}.`,
    `Summary: ${summary.summary}`,
  ];

  if (libraryDesignSystem) {
    sharedLines.push(
      `Library design-system overview: ${libraryDesignSystem.overview}`,
      `Stable shared system patterns: ${joinList(libraryDesignSystem.stablePatterns)}.`,
      `Shared anti-patterns: ${joinList(libraryDesignSystem.antiPatterns)}.`,
      `Color system cues: ${joinList(libraryDesignSystem.colors?.recurringTokens)}.`,
      `Typography system cues: ${joinList(libraryDesignSystem.typography?.recurringPatterns)}.`,
      `Layout system cues: ${joinList(libraryDesignSystem.layout?.recurringPatterns)}.`,
      `Component system cues: ${joinList(libraryDesignSystem.components?.recurringPatterns)}.`,
      `Imagery cues: ${joinList(libraryDesignSystem.imageryIllustration?.recurringPatterns)}.`,
      `Motion cues: ${joinList(libraryDesignSystem.motionInteraction?.recurringPatterns, 'static-first restraint')}.`
    );
  }

  sharedLines.push(
    'This should look like a real creative director board for future software/product design direction, not a generic startup moodboard template.',
    'No stock-photo people, no purple SaaS defaults, no glossy blob aesthetics, no clutter, and no ornamental typography.'
  );

  const branchLines = [
    `Direction: ${branch.id}.`,
    `Thesis: ${branch.thesis}`,
    `Palette notes: ${joinList(branch.paletteNotes)}.`,
    `Typography notes: ${joinList(branch.typographyNotes)}.`,
    `Composition notes: ${joinList(branch.compositionNotes)}.`,
    `Imagery notes: ${joinList(branch.imageryNotes)}.`,
    `Avoid notes: ${joinList(branch.avoidNotes)}.`,
  ];

  if (directionArtifact) {
    branchLines.push(
      `Direction overview: ${directionArtifact.overview}`,
      `Resolved tension: ${directionArtifact.recipe?.resolvedTension || 'none recorded yet'}.`,
      `Primary ingredient recipe: ${joinList((directionArtifact.recipe?.primaryIngredients || []).map((item) => `${item.label} (${item.family})`))}.`,
      `Secondary ingredient recipe: ${joinList((directionArtifact.recipe?.secondaryIngredients || []).map((item) => `${item.label} (${item.family})`))}.`,
      `Suppressed ingredients: ${joinList((directionArtifact.recipe?.intentionallySuppressing || []).map((item) => `${item.label} (${item.family})`), 'none recorded yet')}.`,
      `Direction palette system: ${joinList(directionArtifact.paletteSystem?.recurringTokens)}.`,
      `Direction typography system: ${joinList(directionArtifact.typographySystem?.familyDirection)}.`,
      `Direction composition rules: ${joinList(directionArtifact.compositionRules)}.`,
      `Direction component posture: ${joinList(directionArtifact.componentPosture)}.`,
      `Direction illustration posture: ${joinList(directionArtifact.illustrationPosture)}.`,
      `Direction materiality ingredients: ${joinList((directionArtifact.ingredients?.visual?.materiality || []).map((item) => item.label), 'none recorded yet')}.`,
      `Direction realism ingredients: ${joinList((directionArtifact.ingredients?.visual?.realism || []).map((item) => item.label), 'none recorded yet')}.`,
      `Direction artifact-display ingredients: ${joinList((directionArtifact.ingredients?.pageMaking?.artifactDisplayStrategy || []).map((item) => item.label), 'none recorded yet')}.`,
      `Direction CTA tone: ${joinList(directionArtifact.ctaTone?.principles)}.`,
      `Direction confidence notes: ${joinList(directionArtifact.confidenceNotes)}.`
    );
  }

  return [...sharedLines, '', ...branchLines].join('\n');
}

function mapDirectionArtifactPaths(directionArtifacts) {
  const entries = Object.entries(directionArtifacts || {});
  return Object.fromEntries(entries.map(([direction, artifact]) => [
    direction,
    artifact.designSystemJsonPath,
  ]));
}

function joinList(values, fallback = 'none recorded yet') {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  return values.slice(0, 8).join(', ');
}

function buildTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function truncate(value, maxLength) {
  if (typeof value !== 'string' || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}
