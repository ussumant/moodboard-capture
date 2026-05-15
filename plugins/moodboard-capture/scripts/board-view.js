#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { summarizeTaste } from './taste-summary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultLibraryRoot = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');
const boardFolderName = 'board-view';
const boardManifestFilename = 'board-manifest.json';
const boardStateFilename = 'board-state.json';
const boardBackgroundSvgFilename = 'background.svg';
const defaultBoardPort = Number(process.env.MOODBOARD_CAPTURE_BOARD_PORT || 43119);
const boardServerBootTimeoutMs = 12000;
const boardWidth = 3200;
const boardHeight = 2200;

const boardGroups = [
  {
    id: 'color-mood',
    label: 'Color + Mood',
    description: 'Atmosphere, palette, gradients, and contrast cues.',
    tone: 'color-mood',
    accent: '#7fa6ff',
  },
  {
    id: 'typography',
    label: 'Typography',
    description: 'Type pairings, editorial tone, hierarchy, and readability.',
    tone: 'typography',
    accent: '#72d7a2',
  },
  {
    id: 'materiality',
    label: 'Materiality',
    description: 'Texture, realism, physical cues, and tactile references.',
    tone: 'materiality',
    accent: '#d8ab6b',
  },
  {
    id: 'proof-ui',
    label: 'Proof + UI',
    description: 'Product surfaces, modular layouts, interface proof, and CTAs.',
    tone: 'proof-ui',
    accent: '#d77f72',
  },
];

const tagDefinitions = [
  { label: 'gradient', tone: 'color-mood', patterns: ['gradient', 'glow', 'atmosphere', 'atmospheric'] },
  { label: 'high contrast', tone: 'color-mood', patterns: ['high contrast', 'contrast'] },
  { label: 'warm neutrals', tone: 'color-mood', patterns: ['warm neutrals', 'warm tones', 'neutral palette', 'muted earth', 'soft neutrals'] },
  { label: 'serif / sans', tone: 'typography', patterns: ['serif', 'sans'] },
  { label: 'editorial type', tone: 'typography', patterns: ['editorial', 'headline', 'hierarchy', 'typography'] },
  { label: 'mono accents', tone: 'typography', patterns: ['mono', 'monospace'] },
  { label: 'paper texture', tone: 'materiality', patterns: ['paper', 'texture', 'pinned', 'poster'] },
  { label: 'mesh grid', tone: 'materiality', patterns: ['mesh', 'wire', 'grid wall'] },
  { label: 'physical realism', tone: 'materiality', patterns: ['physical', 'realism', 'tactile', 'analog', 'shadow'] },
  { label: 'product UI', tone: 'proof-ui', patterns: ['product', 'ui', 'dashboard', 'interface'] },
  { label: 'CTA clarity', tone: 'proof-ui', patterns: ['cta', 'button', 'action', 'signup'] },
  { label: 'modular layout', tone: 'proof-ui', patterns: ['modular', 'module', 'grid', 'layout', 'card'] },
];

const groupFallbackTags = {
  'color-mood': 'atmosphere',
  typography: 'type system',
  materiality: 'texture',
  'proof-ui': 'product proof',
};

export async function openMoodboardBoard({
  destinationPath,
  resetLayout = false,
  regenerateBackground = false,
}) {
  const libraryRoot = destinationPath
    ? path.resolve(destinationPath)
    : defaultLibraryRoot;
  const boardPaths = getBoardPaths(libraryRoot);
  await fs.mkdir(boardPaths.boardRoot, { recursive: true });

  const summaryResult = await summarizeTaste({
    destinationPath: libraryRoot,
  });

  const previousManifest = await readJsonIfExists(boardPaths.boardManifestPath);
  const backgroundResult = await ensureBoardBackground({
    boardPaths,
    regenerateBackground,
  });

  const manifest = buildBoardManifest({
    libraryRoot,
    records: summaryResult.records,
    designReferences: summaryResult.designReferences,
    summary: summaryResult.summary,
    summaryPath: summaryResult.summaryPath,
    libraryDesignSystemPath: summaryResult.libraryDesignSystemPath,
    backgroundAssetPath: backgroundResult.assetPath,
    previousManifest,
  });

  const manifestStatus = await writeBoardManifest({
    boardManifestPath: boardPaths.boardManifestPath,
    manifest,
    previousManifest,
  });

  const stateStatus = await ensureBoardStateFile({
    boardStatePath: boardPaths.boardStatePath,
    libraryRoot,
    resetLayout,
  });

  const server = await ensureBoardViewerServer();
  const status = resolveBoardStatus([
    backgroundResult.status,
    manifestStatus,
    stateStatus,
  ]);

  return {
    libraryRoot,
    viewerUrl: buildViewerUrl({
      port: server.port,
      libraryRoot,
    }),
    boardStatePath: boardPaths.boardStatePath,
    boardManifestPath: boardPaths.boardManifestPath,
    backgroundAssetPath: backgroundResult.assetPath,
    status,
  };
}

export function getBoardPaths(libraryRoot) {
  const boardRoot = path.join(libraryRoot, boardFolderName);
  return {
    boardRoot,
    boardManifestPath: path.join(boardRoot, boardManifestFilename),
    boardStatePath: path.join(boardRoot, boardStateFilename),
    boardBackgroundSvgPath: path.join(boardRoot, boardBackgroundSvgFilename),
  };
}

function buildBoardManifest({
  libraryRoot,
  records,
  designReferences,
  summary,
  summaryPath,
  libraryDesignSystemPath,
  backgroundAssetPath,
  previousManifest,
}) {
  const designReferenceMap = new Map(
    (designReferences || []).map((item) => [item.record.id, item])
  );
  const previousItemsById = new Map(
    (previousManifest?.items || []).map((item) => [item.id, item])
  );
  const timestamp = new Date().toISOString();

  /** @type {Array<Record<string, unknown>>} */
  const items = [
    {
      id: 'board-background',
      kind: 'background',
      recordId: null,
      cluster: 'background',
      assetPath: backgroundAssetPath,
      title: 'Board background',
      text: null,
      layout: { x: 0, y: 0, w: boardWidth, h: boardHeight, rotation: 0 },
      locked: true,
      generated: true,
      linkedItemId: null,
      sourceType: null,
      ingredientCluster: null,
      sourceSignals: [],
      lastSyncedAt: timestamp,
    },
  ];

  const classifiedRecords = [];

  for (const record of records || []) {
    if (!record?.assetFilename) {
      continue;
    }

    const designReference = designReferenceMap.get(record.id) || null;
    const primaryGroup = classifyPrimaryGroup({
      record,
      designReference,
      summary,
    });
    const corpus = buildClusterCorpus({ record, designReference, summary });

    classifiedRecords.push({
      record,
      designReference,
      primaryGroup,
      corpus,
    });
  }

  rebalancePrimaryGroups(classifiedRecords);

  const captureItems = [];

  for (const entry of classifiedRecords) {
    const { record, designReference, primaryGroup, corpus } = entry;
    const captureItemId = `capture-${record.id}`;
    const previousCapture = previousItemsById.get(captureItemId);
    const sourceSignals = buildBoardSourceSignals({
      record,
      designReference,
      primaryGroup,
    });
    const groupTags = buildGroupTags({
      corpus,
      primaryGroup,
      sourceSignals,
    });
    const detailSections = buildDetailSections({
      record,
      designReference,
      primaryGroup,
      groupTags,
      sourceSignals,
    });

    captureItems.push({
      id: captureItemId,
      kind: 'capture',
      recordId: record.id,
      cluster: primaryGroup,
      assetPath: path.join(libraryRoot, 'assets', record.assetFilename),
      title: buildCaptureTitle(record),
      text: null,
      layout: {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        rotation: previousCapture?.layout?.rotation ?? resolveCardRotation({
          record,
          primaryGroup,
        }),
      },
      locked: true,
      generated: true,
      linkedItemId: null,
      sourceType: record.sourceType || null,
      ingredientCluster: primaryGroup,
      sourceSignals,
      lastSyncedAt: timestamp,
      primaryGroup,
      groupTags,
      cardAccent: primaryGroup,
      detailSections,
      viewerPriority: buildViewerPriority({
        record,
        designReference,
        primaryGroup,
      }),
    });
  }

  captureItems.sort((left, right) => {
    const leftGroupIndex = boardGroups.findIndex((group) => group.id === left.primaryGroup);
    const rightGroupIndex = boardGroups.findIndex((group) => group.id === right.primaryGroup);
    if (leftGroupIndex !== rightGroupIndex) {
      return leftGroupIndex - rightGroupIndex;
    }
    if (left.viewerPriority !== right.viewerPriority) {
      return right.viewerPriority - left.viewerPriority;
    }
    return String(left.title || '').localeCompare(String(right.title || ''));
  });

  items.push(...captureItems);

  const legacyZones = boardGroups.map((group) => ({
    id: group.id,
    label: group.label,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));

  return {
    version: 2,
    generatedAt: previousManifest?.generatedAt || timestamp,
    updatedAt: timestamp,
    libraryRoot,
    summaryPath,
    libraryDesignSystemPath: libraryDesignSystemPath || null,
    backgroundAssetPath,
    boardSize: { w: boardWidth, h: boardHeight },
    groups: boardGroups,
    zones: legacyZones,
    items,
  };
}

async function writeBoardManifest({ boardManifestPath, manifest, previousManifest }) {
  const nextPayload = `${JSON.stringify(manifest, null, 2)}\n`;
  const previousPayload = previousManifest ? `${JSON.stringify(previousManifest, null, 2)}\n` : null;

  if (previousPayload === nextPayload) {
    return 'reused';
  }

  await fs.writeFile(boardManifestPath, nextPayload, 'utf8');
  return previousManifest ? 'updated' : 'created';
}

async function ensureBoardStateFile({ boardStatePath, libraryRoot, resetLayout }) {
  const exists = await fileExists(boardStatePath);
  if (exists && !resetLayout) {
    return 'reused';
  }

  const state = {
    version: 2,
    updatedAt: new Date().toISOString(),
    libraryRoot,
    mode: 'read-only',
    snapshot: null,
  };
  await fs.writeFile(boardStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return exists ? 'updated' : 'created';
}

async function ensureBoardBackground({ boardPaths, regenerateBackground }) {
  const exists = await fileExists(boardPaths.boardBackgroundSvgPath);
  if (exists && !regenerateBackground) {
    return {
      assetPath: boardPaths.boardBackgroundSvgPath,
      status: 'reused',
    };
  }

  const svg = buildFallbackBoardBackgroundSvg();
  await fs.writeFile(boardPaths.boardBackgroundSvgPath, svg, 'utf8');
  return {
    assetPath: boardPaths.boardBackgroundSvgPath,
    status: exists ? 'updated' : 'created',
  };
}

function classifyPrimaryGroup({ record, designReference, summary }) {
  const scores = {
    'color-mood': 0,
    typography: 0,
    materiality: 0,
    'proof-ui': 0,
  };

  const corpus = buildClusterCorpus({ record, designReference, summary });
  const regionCorpus = (record?.interestingRegions || [])
    .flatMap((region) => [region.id, region.title, region.kind])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (record?.sourceType === 'local-image') {
    scores.materiality += 3;
  } else if (record?.sourceType === 'url') {
    scores['proof-ui'] += 1;
  }

  scores['color-mood'] += matchCount(corpus, [
    'color',
    'palette',
    'gradient',
    'glow',
    'lighting',
    'contrast',
    'atmosphere',
    'atmospheric',
    'warm',
    'muted',
    'blue',
    'neon',
    'mood',
  ]) * 2;
  scores['color-mood'] += matchCount(regionCorpus, [
    'hero',
    'cover',
    'illustration',
    'masthead',
  ]);

  scores.typography += matchCount(corpus, [
    'typography',
    'type',
    'serif',
    'sans',
    'mono',
    'font',
    'headline',
    'editorial',
    'readability',
    'hierarchy',
  ]) * 2;
  scores.typography += matchCount(regionCorpus, [
    'typography',
    'headline',
    'copy',
    'editorial',
    'text',
  ]) * 2;

  scores.materiality += matchCount(corpus, [
    'paper',
    'mesh',
    'wire',
    'texture',
    'material',
    'realism',
    'physical',
    'tactile',
    'analog',
    'shadow',
    'pinned',
    'poster',
  ]) * 2;
  scores.materiality += matchCount(regionCorpus, [
    'texture',
    'material',
    'paper',
    'shadow',
    'wire',
    'mesh',
  ]) * 2;

  scores['proof-ui'] += matchCount(corpus, [
    'product',
    'ui',
    'dashboard',
    'feature',
    'component',
    'card',
    'cta',
    'button',
    'navigation',
    'modular',
    'proof',
    'layout',
    'form',
  ]) * 2;
  scores['proof-ui'] += matchCount(regionCorpus, [
    'product',
    'dashboard',
    'feature',
    'ui',
    'content',
    'form',
  ]) * 2;

  const order = ['materiality', 'typography', 'color-mood', 'proof-ui'];
  return order.reduce((best, candidate) =>
    scores[candidate] > scores[best] ? candidate : best
  , 'proof-ui');
}

function rebalancePrimaryGroups(entries) {
  const counts = countGroups(entries);

  ensureGroup(entries, counts, 'color-mood', /(gradient|palette|atmosphere|contrast|warm|blue|glow|mood)/);
  ensureGroup(entries, counts, 'typography', /(typography|type|serif|sans|mono|editorial|headline|hierarchy)/);
  ensureGroup(entries, counts, 'materiality', /(paper|mesh|texture|physical|realism|tactile|shadow|analog)/);

  while ((counts.get('proof-ui') || 0) < Math.min(2, entries.length)) {
    const candidate = entries.find((entry) =>
      entry.primaryGroup === 'color-mood' || entry.primaryGroup === 'typography'
    );
    if (!candidate) {
      break;
    }
    counts.set(candidate.primaryGroup, Math.max(0, (counts.get(candidate.primaryGroup) || 0) - 1));
    candidate.primaryGroup = 'proof-ui';
    counts.set('proof-ui', (counts.get('proof-ui') || 0) + 1);
  }
}

function ensureGroup(entries, counts, groupId, pattern) {
  if ((counts.get(groupId) || 0) > 0) {
    return;
  }

  const candidate = entries.find((entry) =>
    entry.primaryGroup === 'proof-ui'
    && (counts.get('proof-ui') || 0) > 2
    && pattern.test(entry.corpus || '')
  ) || entries.find((entry) =>
    entry.primaryGroup !== groupId
    && pattern.test(entry.corpus || '')
  );

  if (!candidate) {
    return;
  }

  counts.set(candidate.primaryGroup, Math.max(0, (counts.get(candidate.primaryGroup) || 0) - 1));
  candidate.primaryGroup = groupId;
  counts.set(groupId, (counts.get(groupId) || 0) + 1);
}

function countGroups(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.primaryGroup, (counts.get(entry.primaryGroup) || 0) + 1);
  }
  return counts;
}

function buildClusterCorpus({ record, designReference, summary }) {
  const extraction = designReference?.extraction || {};
  const ingredients = extraction.ingredients || {};
  const lines = [
    record?.userNote,
    record?.whyItWorks,
    ...(record?.designSignals || []),
    ...(record?.visualTraits?.typography || []),
    ...(record?.visualTraits?.imagery || []),
    ...(record?.visualTraits?.materials || []),
    ...(record?.interestingRegions || []).flatMap((region) => [
      region.title,
      region.kind,
      region.whyItMatters,
      ...(region.signals || []),
    ]),
    ...(extraction.keyCharacteristics || []),
    ...(extraction.dos || []),
    ...(extraction.donts || []),
    ...(extraction.sourceEvidence || []),
    ...flattenIngredientLabels(ingredients),
    ...flattenIngredientSignals(ingredients),
    ...(summary?.stablePreferences || []),
    ...(summary?.tensions || []),
  ];

  return lines
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();
}

function buildBoardSourceSignals({ record, designReference, primaryGroup }) {
  const extraction = designReference?.extraction || {};
  const ingredients = extraction.ingredients || {};
  const ingredientLabels = [
    ...flattenIngredientLabels(ingredients),
    ...flattenIngredientSignals(ingredients),
  ];

  return uniqueStrings([
    ...(record?.designSignals || []),
    ...(record?.interestingRegions || []).flatMap((region) => [region.title, ...(region.signals || [])]),
    ...ingredientLabels,
    groupLabel(primaryGroup),
  ]).map((value) => compactPhrase(value, 40)).filter(Boolean).slice(0, 6);
}

function buildGroupTags({ corpus, primaryGroup, sourceSignals }) {
  const candidates = [];
  for (const definition of tagDefinitions) {
    const matchedPatterns = definition.patterns.filter((pattern) => corpus.includes(pattern));
    if (matchedPatterns.length === 0) {
      continue;
    }
    candidates.push({
      label: definition.label,
      tone: definition.tone,
      weight: (definition.tone === primaryGroup ? 100 : 0) + matchedPatterns.length,
    });
  }

  const fallbackSignal = sourceSignals.find(Boolean);
  if (fallbackSignal) {
    candidates.push({
      label: compactPhrase(fallbackSignal, 18),
      tone: primaryGroup,
      weight: 1,
    });
  }

  candidates.sort((left, right) => right.weight - left.weight);

  const seen = new Set();
  const tags = [];
  for (const candidate of candidates) {
    const normalized = candidate.label.toLowerCase();
    if (!candidate.label || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push({
      label: candidate.label,
      tone: candidate.tone,
    });
    if (tags.length === 2) {
      break;
    }
  }

  if (tags.length === 0) {
    tags.push({
      label: groupFallbackTags[primaryGroup] || 'reference',
      tone: primaryGroup,
    });
  }

  return tags;
}

function buildDetailSections({
  record,
  designReference,
  primaryGroup,
  groupTags,
  sourceSignals,
}) {
  const extraction = designReference?.extraction || {};
  const ingredients = extraction.ingredients || {};
  const derivedPrimaryIngredients = pickIngredientLabelsForGroup(ingredients, primaryGroup).slice(0, 4);
  const primaryIngredients = derivedPrimaryIngredients.length > 0
    ? derivedPrimaryIngredients
    : uniqueStrings([
        ...groupTags.filter((tag) => tag.tone === primaryGroup).map((tag) => tag.label),
        ...sourceSignals,
      ]).slice(0, 3);
  const secondaryIngredients = uniqueStrings([
    ...groupTags.filter((tag) => tag.tone !== primaryGroup).map((tag) => tag.label),
    ...pickSecondaryIngredientLabels(ingredients, primaryGroup),
  ])
    .filter((value) => !primaryIngredients.includes(value))
    .slice(0, 4);

  return {
    whyItStoodOut: buildWhyItStoodOut({
      record,
      extraction,
    }),
    primaryIngredients,
    secondaryIngredients,
    topSignals: sourceSignals.slice(0, 5),
    relatedArtifacts: buildRelatedArtifacts(record),
  };
}

function buildWhyItStoodOut({ record, extraction }) {
  const value = record?.userNote
    || record?.whyItWorks
    || extraction?.overview
    || record?.designSignals?.[0]
    || 'Saved as a taste reference.';
  return truncateSentence(String(value).trim(), 220);
}

function buildRelatedArtifacts(record) {
  const candidates = [
    { label: 'Design doc', path: record?.designMdPath },
    { label: 'Design JSON', path: record?.designSystemJsonPath },
  ];

  return candidates.filter((candidate) => typeof candidate.path === 'string' && candidate.path.trim());
}

function pickIngredientLabelsForGroup(ingredients, primaryGroup) {
  const familyMap = {
    'color-mood': [
      'visual.palette',
      'visual.mood',
      'pageMaking.heroPosture',
    ],
    typography: [
      'visual.typography',
      'visual.layoutRhythm',
    ],
    materiality: [
      'visual.materiality',
      'visual.realism',
      'visual.imageryMode',
    ],
    'proof-ui': [
      'visual.layoutRhythm',
      'pageMaking.proofStyle',
      'pageMaking.ctaTone',
      'pageMaking.artifactDisplayStrategy',
      'pageMaking.installVisibility',
    ],
  };

  return uniqueStrings(familyMap[primaryGroup].flatMap((family) => getIngredientFamilyLabels(ingredients, family)));
}

function pickSecondaryIngredientLabels(ingredients, primaryGroup) {
  const otherGroups = boardGroups
    .map((group) => group.id)
    .filter((groupId) => groupId !== primaryGroup);

  return uniqueStrings(otherGroups.flatMap((groupId) => pickIngredientLabelsForGroup(ingredients, groupId))).slice(0, 6);
}

function getIngredientFamilyLabels(ingredients, family) {
  const [scope, key] = family.split('.');
  return (ingredients?.[scope]?.[key] || [])
    .map((item) => item?.label)
    .filter(Boolean);
}

function buildViewerPriority({ record, designReference, primaryGroup }) {
  let priority = 0;

  if (record?.sourceType === 'local-image') {
    priority += 24;
  }
  if (record?.whyItWorks || record?.userNote) {
    priority += 12;
  }
  if (Array.isArray(record?.designSignals)) {
    priority += Math.min(10, record.designSignals.length * 2);
  }
  if (designReference?.extraction) {
    priority += 10;
  }
  if (primaryGroup === 'proof-ui') {
    priority += 4;
  }

  return priority;
}

function resolveCardRotation({ record, primaryGroup }) {
  const base = deterministicRotation(record?.id || primaryGroup);
  const factor = primaryGroup === 'materiality'
    ? 0.36
    : primaryGroup === 'proof-ui'
      ? 0.16
      : 0.22;
  return base * factor;
}

function buildCaptureTitle(record) {
  if (record?.sourceUrl) {
    try {
      const url = new URL(record.sourceUrl);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return record.sourceUrl;
    }
  }

  return record?.assetFilename || record?.id || 'capture';
}

function groupLabel(groupId) {
  return boardGroups.find((group) => group.id === groupId)?.label || groupId;
}

async function ensureBoardViewerServer() {
  if (await isBoardServerHealthy(defaultBoardPort)) {
    return {
      port: defaultBoardPort,
      status: 'reused',
    };
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'board-viewer-server.js')], {
    cwd: path.resolve(__dirname, '..'),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MOODBOARD_CAPTURE_BOARD_PORT: String(defaultBoardPort),
    },
  });
  child.unref();

  await waitForBoardServer(defaultBoardPort);
  return {
    port: defaultBoardPort,
    status: 'created',
  };
}

function buildViewerUrl({ port, libraryRoot }) {
  return `http://127.0.0.1:${port}/?libraryRoot=${encodeURIComponent(libraryRoot)}`;
}

async function isBoardServerHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBoardServer(port) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < boardServerBootTimeoutMs) {
    if (await isBoardServerHealthy(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for the local moodboard board viewer server to start.');
}

function buildFallbackBoardBackgroundSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}" viewBox="0 0 ${boardWidth} ${boardHeight}">
  <defs>
    <linearGradient id="wall" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a1630"/>
      <stop offset="48%" stop-color="#071122"/>
      <stop offset="100%" stop-color="#040b17"/>
    </linearGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#132445"/>
      <stop offset="100%" stop-color="#0a1428"/>
    </linearGradient>
    <linearGradient id="backer" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f2040"/>
      <stop offset="100%" stop-color="#09142b"/>
    </linearGradient>
    <radialGradient id="cloudOne" cx="18%" cy="18%" r="48%">
      <stop offset="0%" stop-color="#d6eeff" stop-opacity="0.9"/>
      <stop offset="28%" stop-color="#7eaeff" stop-opacity="0.46"/>
      <stop offset="100%" stop-color="#7eaeff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cloudTwo" cx="76%" cy="24%" r="38%">
      <stop offset="0%" stop-color="#97beff" stop-opacity="0.55"/>
      <stop offset="36%" stop-color="#5476ff" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#5476ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cloudThree" cx="54%" cy="78%" r="44%">
      <stop offset="0%" stop-color="#629aff" stop-opacity="0.42"/>
      <stop offset="40%" stop-color="#2a5cd6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#2a5cd6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="mesh" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M 0 0 L 44 0 M 0 0 L 0 44" stroke="#8099c9" stroke-width="1.08" opacity="0.28"/>
    </pattern>
    <pattern id="speckle" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="16" cy="28" r="1" fill="#b7c9ec" opacity="0.12"/>
      <circle cx="72" cy="48" r="1.2" fill="#8ea6d5" opacity="0.1"/>
      <circle cx="98" cy="92" r="0.9" fill="#edf5ff" opacity="0.08"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#000000" flood-opacity="0.34"/>
    </filter>
    <filter id="cloudBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="58"/>
    </filter>
  </defs>

  <rect width="${boardWidth}" height="${boardHeight}" fill="url(#wall)"/>
  <rect width="${boardWidth}" height="${boardHeight}" fill="url(#cloudOne)" filter="url(#cloudBlur)"/>
  <rect width="${boardWidth}" height="${boardHeight}" fill="url(#cloudTwo)" filter="url(#cloudBlur)"/>
  <rect width="${boardWidth}" height="${boardHeight}" fill="url(#cloudThree)" filter="url(#cloudBlur)"/>
  <g filter="url(#shadow)">
    <rect x="120" y="118" width="2960" height="1940" rx="34" fill="url(#frame)"/>
    <rect x="154" y="152" width="2892" height="1872" rx="22" fill="url(#backer)"/>
    <rect x="154" y="152" width="2892" height="1872" rx="22" fill="url(#speckle)" opacity="0.68"/>
    <rect x="190" y="188" width="2820" height="1800" rx="10" fill="url(#mesh)" opacity="0.92"/>
  </g>
  <g fill="#c8d7f6" opacity="0.54">
    <circle cx="190" cy="188" r="6"/>
    <circle cx="3010" cy="188" r="6"/>
    <circle cx="190" cy="1988" r="6"/>
    <circle cx="3010" cy="1988" r="6"/>
    <rect x="726" y="184" width="18" height="34" rx="7"/>
    <rect x="1600" y="184" width="18" height="34" rx="7"/>
    <rect x="2474" y="184" width="18" height="34" rx="7"/>
  </g>
</svg>`;
}

function flattenIngredientLabels(ingredients) {
  const labels = [];
  for (const scope of ['visual', 'pageMaking']) {
    for (const values of Object.values(ingredients?.[scope] || {})) {
      for (const item of values || []) {
        if (item?.label) {
          labels.push(item.label);
        }
      }
    }
  }
  return labels;
}

function flattenIngredientSignals(ingredients) {
  const signals = [];
  for (const scope of ['visual', 'pageMaking']) {
    for (const values of Object.values(ingredients?.[scope] || {})) {
      for (const item of values || []) {
        signals.push(...(item?.signals || []));
      }
    }
  }
  return signals;
}

function deterministicRotation(seed) {
  const hash = hashString(seed);
  const degrees = ((hash % 9) - 4);
  return (degrees * Math.PI) / 180;
}

function hashString(value) {
  let hash = 0;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function matchCount(corpus, keywords) {
  return keywords.reduce((count, keyword) =>
    corpus.includes(keyword) ? count + 1 : count
  , 0);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function compactPhrase(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  const cleaned = value
    .replace(/^use of /i, '')
    .replace(/^uses? /i, '')
    .replace(/^integration of /i, '')
    .replace(/^shows preference for /i, '')
    .replace(/^highlight /i, '')
    .replace(/^highlights /i, '')
    .replace(/^combine /i, '')
    .replace(/^combines /i, '')
    .replace(/^clear /i, '')
    .replace(/^consistent /i, '')
    .replace(/^the design /i, '')
    .replace(/\bsection\b/gi, '')
    .replace(/\bcomponents?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const short = cleaned.split(/[:,-]/)[0].trim();
  return truncateSentence(short.toLowerCase(), maxLength);
}

function truncateSentence(value, maxLength) {
  if (typeof value !== 'string' || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trim()}...`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveBoardStatus(statuses) {
  if (statuses.includes('created')) {
    return 'created';
  }
  if (statuses.includes('updated')) {
    return 'updated';
  }
  return 'reused';
}
