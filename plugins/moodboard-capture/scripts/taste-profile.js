#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const localProfileFilename = 'taste-profile.json';
const globalProfileFilename = 'workspace-taste-profile.json';

/**
 * @typedef {Object} TasteProfile
 * @property {'local'|'global'} profileScope
 * @property {string} updatedAt
 * @property {number} captureCount
 * @property {string[]} recurringPreferences
 * @property {string[]} avoidedPatterns
 * @property {string[]} recurringMoods
 * @property {string[]} compositionTendencies
 * @property {string[]} typePreferences
 * @property {string[]} palettePreferences
 * @property {string[]} materialTexturePreferences
 * @property {string} summary
 * @property {Object.<string, number>} signalCounts
 */

/**
 * @typedef {Object} ProfileUpdateResult
 * @property {string} localProfilePath
 * @property {string} globalProfilePath
 * @property {{local: string, global: string}} profileUpdateStatus
 */

export async function updateTasteProfiles({
  localLibraryRoot,
  globalLibraryRoot,
  currentRecord,
}) {
  const existingLocalRecords = await readLibraryRecords(path.join(localLibraryRoot, 'library.jsonl'));
  const localProfile = buildTasteProfile({
    scope: 'local',
    records: [...existingLocalRecords, currentRecord],
  });
  const localProfilePath = path.join(localLibraryRoot, localProfileFilename);
  await fs.mkdir(localLibraryRoot, { recursive: true });
  await fs.writeFile(localProfilePath, `${JSON.stringify(localProfile, null, 2)}\n`, 'utf8');

  const globalProfilePath = path.join(globalLibraryRoot, globalProfileFilename);
  if (globalLibraryRoot === localLibraryRoot) {
    const globalProfile = buildTasteProfile({
      scope: 'global',
      records: [...existingLocalRecords, currentRecord],
    });
    await fs.writeFile(globalProfilePath, `${JSON.stringify(globalProfile, null, 2)}\n`, 'utf8');
    return {
      localProfilePath,
      globalProfilePath,
      profileUpdateStatus: {
        local: 'updated',
        global: 'updated',
      },
      profileUpdateErrors: {
        local: null,
        global: null,
      },
    };
  }

  const workspaceLibraries = await findLibraryIndexes(globalLibraryRoot);
  const globalRecords = [];

  for (const libraryIndexPath of workspaceLibraries) {
    const records = await readLibraryRecords(libraryIndexPath);
    globalRecords.push(...records);
  }

  const localIndexPath = path.join(localLibraryRoot, 'library.jsonl');
  if (!workspaceLibraries.includes(localIndexPath)) {
    globalRecords.push(...existingLocalRecords, currentRecord);
  }

  const globalProfile = buildTasteProfile({
    scope: 'global',
    records: globalRecords,
  });

  let globalStatus = 'updated';
  let globalError = null;

  try {
    await fs.mkdir(globalLibraryRoot, { recursive: true });
    await fs.writeFile(globalProfilePath, `${JSON.stringify(globalProfile, null, 2)}\n`, 'utf8');
  } catch (error) {
    globalStatus = 'failed';
    globalError = error.message;
  }

  return {
    localProfilePath,
    globalProfilePath,
    profileUpdateStatus: {
      local: 'updated',
      global: globalStatus,
    },
    profileUpdateErrors: {
      local: null,
      global: globalError,
    },
  };
}

export function buildTasteProfile({ scope, records }) {
  const completeRecords = records.filter((record) => record?.analysisStatus === 'complete' && record?.tasteAnalysis);
  const signalCounts = accumulateSignals(completeRecords);

  /** @type {TasteProfile} */
  const profile = {
    profileScope: scope,
    updatedAt: new Date().toISOString(),
    captureCount: completeRecords.length,
    recurringPreferences: topKeys(signalCounts.recurringThemes),
    avoidedPatterns: topKeys(signalCounts.avoidedPatterns),
    recurringMoods: topKeys(signalCounts.preferredMoods),
    compositionTendencies: topKeys(signalCounts.preferredCompositions),
    typePreferences: topKeys(signalCounts.preferredTypography),
    palettePreferences: topKeys(signalCounts.preferredPalettes),
    materialTexturePreferences: topKeys(signalCounts.preferredMaterials),
    summary: buildProfileSummary({
      scope,
      captureCount: completeRecords.length,
      recurringPreferences: topKeys(signalCounts.recurringThemes),
      recurringMoods: topKeys(signalCounts.preferredMoods),
      compositionTendencies: topKeys(signalCounts.preferredCompositions),
      palettePreferences: topKeys(signalCounts.preferredPalettes),
    }),
    signalCounts: flattenCounts(signalCounts),
  };

  return profile;
}

export async function readLibraryRecords(indexPath) {
  let raw;
  try {
    raw = await fs.readFile(indexPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function writeLibraryRecords(indexPath, records) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const payload = normalizedRecords.map((record) => JSON.stringify(record)).join('\n');
  const finalPayload = payload ? `${payload}\n` : '';
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, finalPayload, 'utf8');
}

export async function readTasteProfile(profilePath) {
  let raw;
  try {
    raw = await fs.readFile(profilePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Taste profile not found: ${profilePath}`);
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Taste profile is not valid JSON: ${profilePath}`);
  }
}

async function findLibraryIndexes(startRoot) {
  const queue = [{ dir: path.resolve(startRoot), depth: 0 }];
  const seen = new Set();
  const indexes = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.dir)) {
      continue;
    }
    seen.add(current.dir);

    let entries;
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(current.dir, entry.name);

      if (entry.isFile() && entry.name === 'library.jsonl') {
        indexes.push(fullPath);
        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      if (current.depth >= 4) {
        continue;
      }

      if (entry.name === 'node_modules') {
        continue;
      }

      queue.push({ dir: fullPath, depth: current.depth + 1 });
    }
  }

  return indexes;
}

function accumulateSignals(records) {
  const totals = {
    preferredTypography: {},
    preferredPalettes: {},
    preferredCompositions: {},
    preferredMoods: {},
    preferredMaterials: {},
    recurringThemes: {},
    avoidedPatterns: {},
  };

  for (const record of records) {
    const contributions = record?.profileContributions || record?.tasteAnalysis?.profileContributions;
    if (!contributions) {
      continue;
    }

    addValues(totals.preferredTypography, contributions.preferredTypography);
    addValues(totals.preferredPalettes, contributions.preferredPalettes);
    addValues(totals.preferredCompositions, contributions.preferredCompositions);
    addValues(totals.preferredMoods, contributions.preferredMoods);
    addValues(totals.preferredMaterials, contributions.preferredMaterials);
    addValues(totals.recurringThemes, contributions.recurringThemes);
    addValues(totals.avoidedPatterns, contributions.avoidedPatterns);
  }

  return totals;
}

function addValues(target, values) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    target[trimmed] = (target[trimmed] || 0) + 1;
  }
}

function topKeys(counts, limit = 6) {
  return Object.entries(counts)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key]) => key);
}

function flattenCounts(countGroups) {
  const flat = {};
  for (const [group, counts] of Object.entries(countGroups)) {
    for (const [key, value] of Object.entries(counts)) {
      flat[`${group}:${key}`] = value;
    }
  }
  return flat;
}

function buildProfileSummary({
  scope,
  captureCount,
  recurringPreferences,
  recurringMoods,
  compositionTendencies,
  palettePreferences,
}) {
  if (captureCount === 0) {
    return scope === 'global'
      ? 'No completed taste analyses have contributed to the workspace profile yet.'
      : 'No completed taste analyses have contributed to this moodboard profile yet.';
  }

  const fragments = [
    recurringPreferences[0] ? `This taste profile repeatedly favors ${recurringPreferences.slice(0, 3).join(', ')}` : null,
    recurringMoods[0] ? `with moods like ${recurringMoods.slice(0, 2).join(', ')}` : null,
    compositionTendencies[0] ? `and composition tendencies such as ${compositionTendencies.slice(0, 2).join(', ')}` : null,
    palettePreferences[0] ? `alongside palettes like ${palettePreferences.slice(0, 2).join(', ')}` : null,
  ].filter(Boolean);

  if (fragments.length === 0) {
    return `This ${scope} taste profile currently summarizes ${captureCount} analyzed captures.`;
  }

  return `${fragments.join(' ')}. Based on ${captureCount} analyzed captures.`;
}
