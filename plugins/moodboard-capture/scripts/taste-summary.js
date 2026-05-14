#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  loadCompleteDesignReferences,
  synthesizeLibraryDesignSystem,
  writeLibraryDesignArtifacts,
} from './design-system.js';
import {
  buildTasteProfile,
  readLibraryRecords,
  readTasteProfile,
} from './taste-profile.js';

const defaultLibraryRoot = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');
const defaultSummaryFilename = 'taste-summary.json';

/**
 * @typedef {Object} TasteBranchDirection
 * @property {string} id
 * @property {string} thesis
 * @property {string[]} paletteNotes
 * @property {string[]} typographyNotes
 * @property {string[]} compositionNotes
 * @property {string[]} imageryNotes
 * @property {string[]} avoidNotes
 */

/**
 * @typedef {Object} TasteSummary
 * @property {string[]} stablePreferences
 * @property {string[]} antiPatterns
 * @property {string[]} tensions
 * @property {TasteBranchDirection[]} branchDirections
 * @property {string} summary
 * @property {Object} sourceSignals
 */

export async function summarizeTaste({
  destinationPath,
  profilePath,
}) {
  const libraryRoot = destinationPath
    ? path.resolve(destinationPath)
    : defaultLibraryRoot;
  const resolvedProfilePath = profilePath
    ? path.resolve(profilePath)
    : path.join(libraryRoot, 'taste-profile.json');
  const summaryPath = path.join(libraryRoot, defaultSummaryFilename);
  const libraryPath = path.join(libraryRoot, 'library.jsonl');
  const records = await readLibraryRecords(libraryPath);
  const designReferences = await loadCompleteDesignReferences({
    records,
    libraryRoot,
  });
  const tasteProfile = await loadTasteProfile({
    profilePath: resolvedProfilePath,
    records,
  });
  const summary = buildTasteSummary({
    profile: tasteProfile,
    records,
    designReferences,
  });

  await fs.mkdir(libraryRoot, { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const libraryDesignSystem = await synthesizeLibraryDesignSystem({
    records,
    tasteSummary: summary,
    libraryRoot,
  });
  const libraryDesignArtifacts = await writeLibraryDesignArtifacts({
    libraryRoot,
    synthesis: libraryDesignSystem,
  });

  return {
    libraryRoot,
    profilePath: resolvedProfilePath,
    summaryPath,
    summary,
    records,
    designReferences,
    libraryDesignSystemPath: libraryDesignArtifacts.designSystemJsonPath,
    libraryDesignMdPath: libraryDesignArtifacts.designMdPath,
    libraryDesignSystem,
  };
}

export function buildTasteSummary({ profile, records, designReferences = [] }) {
  const complete = records.filter((record) => record?.analysisStatus === 'complete' && record?.tasteAnalysis);
  const signalGroups = collectSignals(complete, designReferences);

  const stablePreferences = uniqueStrings([
    ...profile.recurringPreferences.slice(0, 4),
    ...profile.typePreferences.slice(0, 3),
    ...profile.palettePreferences.slice(0, 3),
    ...profile.compositionTendencies.slice(0, 3),
    ...signalGroups.designCharacteristics.slice(0, 4),
  ]).slice(0, 10);

  const antiPatterns = uniqueStrings(profile.avoidedPatterns).slice(0, 8);
  const tensions = inferTensions({ profile, signalGroups });
  const branchDirections = buildBranchDirections({ profile, signalGroups });
  const readableSummary = buildReadableSummary({
    captureCount: profile.captureCount,
    stablePreferences,
    tensions,
    antiPatterns,
  });

  /** @type {TasteSummary} */
  return {
    stablePreferences,
    antiPatterns,
    tensions,
    branchDirections,
    summary: readableSummary,
    sourceSignals: {
      captureCount: profile.captureCount,
      recurringMoods: profile.recurringMoods,
      palettePreferences: profile.palettePreferences,
      typePreferences: profile.typePreferences,
      compositionTendencies: profile.compositionTendencies,
      materialTexturePreferences: profile.materialTexturePreferences,
      recurringPreferences: profile.recurringPreferences,
      referenceDesignCount: designReferences.length,
    },
  };
}

async function loadTasteProfile({ profilePath, records }) {
  try {
    return await readTasteProfile(profilePath);
  } catch (error) {
    if (!error.message.includes('Taste profile not found')) {
      throw error;
    }
    return buildTasteProfile({
      scope: 'local',
      records,
    });
  }
}

function collectSignals(records, designReferences) {
  const tones = [];
  const imagery = [];
  const palettes = [];
  const typography = [];
  const composition = [];
  const materials = [];
  const avoids = [];
  const designCharacteristics = [];

  for (const record of records) {
    const analysis = record.tasteAnalysis;
    if (!analysis) {
      continue;
    }

    tones.push(...normalizeArray(analysis.visualTraits?.mood));
    imagery.push(...normalizeArray(analysis.visualTraits?.imagery));
    palettes.push(...normalizeArray(analysis.visualTraits?.colorTreatment));
    typography.push(...normalizeArray(analysis.visualTraits?.typography));
    composition.push(...normalizeArray(analysis.visualTraits?.composition));
    materials.push(...normalizeArray(analysis.visualTraits?.materials));
    avoids.push(...normalizeArray(analysis.profileContributions?.avoidedPatterns));
  }

  for (const item of designReferences) {
    designCharacteristics.push(...normalizeArray(item.extraction?.keyCharacteristics));
    palettes.push(...normalizeArray(item.extraction?.colors?.gradientNotes));
    typography.push(...normalizeArray(item.extraction?.typography?.principles));
    composition.push(...normalizeArray(item.extraction?.layout?.gridNotes));
    imagery.push(...normalizeArray(item.extraction?.imageryIllustration?.styles));
    materials.push(...normalizeArray(item.extraction?.imageryIllustration?.behaviors));
    avoids.push(...normalizeArray(item.extraction?.donts));
  }

  return {
    tones: uniqueStrings(tones),
    imagery: uniqueStrings(imagery),
    palettes: uniqueStrings(palettes),
    typography: uniqueStrings(typography),
    composition: uniqueStrings(composition),
    materials: uniqueStrings(materials),
    avoids: uniqueStrings(avoids),
    designCharacteristics: uniqueStrings(designCharacteristics),
  };
}

function inferTensions({ profile, signalGroups }) {
  const tensions = [];

  if (hasAny(profile.recurringPreferences, ['tech', 'developer', 'system', 'data']) &&
      hasAny(profile.recurringPreferences, ['nature', 'human', 'storytelling'])) {
    tensions.push('Technical rigor vs human warmth');
  }

  if (hasAny(profile.materialTexturePreferences, ['gradients', 'digital', 'glitch']) &&
      hasAny(profile.materialTexturePreferences, ['paper', 'hand-drawn', 'organic', 'analog'])) {
    tensions.push('Digital precision vs tactile texture');
  }

  if (hasAny(profile.recurringMoods, ['calm', 'trustworthy', 'professional']) &&
      hasAny(profile.recurringMoods, ['playful', 'nostalgic', 'strange'])) {
    tensions.push('Calm credibility vs memorable playfulness');
  }

  if (hasAny(signalGroups.imagery, ['photographic', 'realistic screenshots']) &&
      hasAny(signalGroups.imagery, ['abstract', 'illustration', 'pixel-art', 'conceptual'])) {
    tensions.push('Functional product proof vs abstract brand storytelling');
  }

  return tensions.length > 0 ? tensions : ['Clarity and trust are dominant, with a secondary pull toward warmth and distinctiveness'];
}

function buildBranchDirections({ profile, signalGroups }) {
  const sharedAvoids = uniqueStrings([
    ...profile.avoidedPatterns.slice(0, 4),
    ...signalGroups.avoids.slice(0, 4),
  ]).slice(0, 6);

  return [
    {
      id: 'infra-editorial',
      thesis: 'Turn the taste profile toward rigorous infra credibility with strong hierarchy, whitespace, and disciplined accents.',
      paletteNotes: pickNotes(profile.palettePreferences, ['blue', 'charcoal', 'contrast', 'yellow'], 4),
      typographyNotes: pickNotes(profile.typePreferences, ['hierarchy', 'sans', 'readability', 'monospace'], 4),
      compositionNotes: pickNotes(profile.compositionTendencies, ['centered', 'grid', 'section', 'whitespace'], 4),
      imageryNotes: pickNotes(signalGroups.imagery, ['abstract', 'system', 'diagram', 'minimal'], 4),
      avoidNotes: sharedAvoids,
    },
    {
      id: 'warm-technical',
      thesis: 'Express serious software taste with tactile warmth, calm structure, and a humanized technical feel.',
      paletteNotes: pickNotes(profile.palettePreferences, ['warm', 'beige', 'cream', 'blue', 'green'], 4),
      typographyNotes: pickNotes(profile.typePreferences, ['bold', 'body', 'readability', 'scale'], 4),
      compositionNotes: pickNotes(profile.compositionTendencies, ['alternating', 'modular', 'space', 'centered'], 4),
      imageryNotes: pickNotes(signalGroups.imagery, ['illustration', 'hand-drawn', 'screenshots', 'organic'], 4),
      avoidNotes: sharedAvoids,
    },
    {
      id: 'strange-systems',
      thesis: 'Keep the trust and clarity, but push toward quiet memorability through system strangeness and controlled tension.',
      paletteNotes: pickNotes(profile.palettePreferences, ['blue', 'accent', 'contrast', 'pastel'], 4),
      typographyNotes: pickNotes(profile.typePreferences, ['sans', 'hierarchy', 'clear', 'monospace'], 4),
      compositionNotes: pickNotes(profile.compositionTendencies, ['centered', 'section', 'grid', 'alternating'], 4),
      imageryNotes: pickNotes(signalGroups.imagery, ['abstract', 'pixel', 'glitch', 'conceptual'], 4),
      avoidNotes: sharedAvoids,
    },
  ];
}

function buildReadableSummary({ captureCount, stablePreferences, tensions, antiPatterns }) {
  const preferenceLead = stablePreferences.slice(0, 4).join(', ') || 'clarity and trust';
  const tensionLead = tensions.slice(0, 2).join('; ') || 'a mild pull toward memorable distinctiveness';
  const avoidLead = antiPatterns.slice(0, 3).join(', ') || 'clutter and ornamental styling';

  return `Across ${captureCount} analyzed captures, this taste consistently favors ${preferenceLead}. The most meaningful tensions are ${tensionLead}. It wants software design that feels serious, spacious, and trustworthy, while avoiding ${avoidLead}.`;
}

function pickNotes(values, keywords, limit) {
  const normalizedValues = normalizeArray(values);
  const preferred = normalizedValues.filter((value) =>
    keywords.some((keyword) => value.toLowerCase().includes(keyword))
  );
  const combined = uniqueStrings([...preferred, ...normalizedValues]);
  return combined.slice(0, limit);
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values) {
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || result.includes(trimmed)) {
      continue;
    }
    result.push(trimmed);
  }
  return result;
}

function hasAny(values, fragments) {
  if (!Array.isArray(values)) {
    return false;
  }
  return values.some((value) =>
    typeof value === 'string' && fragments.some((fragment) => value.toLowerCase().includes(fragment))
  );
}
