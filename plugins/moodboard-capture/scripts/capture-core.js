#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { analyzeCaptureTaste } from './taste-analysis.js';
import {
  getReferenceDesignPaths,
  normalizeDesignFacets,
  writeReferenceDesignArtifacts,
} from './design-system.js';
import { collectPageInsights } from './page-insights.js';
import {
  readLibraryRecords,
  updateTasteProfiles,
  writeLibraryRecords,
} from './taste-profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const globalFallback = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');
const libraryIndexFilename = 'library.jsonl';
const assetsDirectoryName = 'assets';
const supportedLocalImageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.avif',
]);

const desktopViewport = {
  width: 1440,
  height: 1100,
  deviceScaleFactor: 2,
};

/**
 * @typedef {Object} MoodboardRecord
 * @property {string} id
 * @property {string} createdAt
 * @property {'url'|'local-image'} sourceType
 * @property {string|null} sourceUrl
 * @property {string|null} sourcePath
 * @property {string} assetFilename
 * @property {string} resolvedDestination
 * @property {string[]} tags
 * @property {string|null} whyLiked
 * @property {string[]} styleCues
 * @property {string|null} userNote
 * @property {'complete'|'failed'|'pending'} analysisStatus
 * @property {Object|null} visualTraits
 * @property {string|null} whyItWorks
 * @property {string[]} designSignals
 * @property {Object|null} profileContributions
 * @property {Object|null} tasteAnalysis
 * @property {string|null} analysisError
 * @property {'complete'|'failed'|'pending'} designExtractionStatus
 * @property {string|null} designSystemJsonPath
 * @property {string|null} designMdPath
 * @property {string[]} designFacets
 * @property {Object[]} interestingRegions
 * @property {string|null} designExtractionError
 * @property {Object|null} pageInsights
 */

export async function captureTaste({
  url,
  localImagePath,
  destinationPath,
  workspaceRoot,
  tags,
  whyLiked,
  styleCues,
  userNote,
  facets,
}) {
  const source = await resolveSourceInput({ url, localImagePath });
  const rootHint = resolveWorkspaceHint(workspaceRoot);
  const destination = await resolveDestination({
    destinationPath,
    workspaceRoot: rootHint,
  });
  const normalizedFacets = normalizeDesignFacets(facets);

  const libraryRoot = destination.resolvedPath;
  const assetsPath = path.join(libraryRoot, assetsDirectoryName);
  const timestamp = new Date();
  const metadata = normalizeMetadata({ tags, whyLiked, styleCues, userNote });
  const assetFilename = buildAssetFileName(source, timestamp);
  const savedAssetPath = path.join(assetsPath, assetFilename);
  const indexPath = path.join(libraryRoot, libraryIndexFilename);

  await fs.mkdir(assetsPath, { recursive: true });

  let pageInsights = null;
  if (source.type === 'url') {
    pageInsights = await capturePage(source.normalizedUrl, savedAssetPath);
  } else {
    await copyLocalImage(source.absolutePath, savedAssetPath);
  }

  const record = buildBaseLibraryRecord({
    source,
    destinationPath: libraryRoot,
    assetFilename,
    timestamp,
    metadata,
    facets: normalizedFacets,
    pageInsights,
  });

  const globalProfileRoot = await resolveGlobalProfileRoot({
    localLibraryRoot: libraryRoot,
  });

  let localProfilePath = path.join(libraryRoot, 'taste-profile.json');
  let globalProfilePath = path.join(globalProfileRoot, 'workspace-taste-profile.json');
  let profileUpdateStatus = {
    local: 'skipped',
    global: 'skipped',
  };
  let profileUpdateError = null;

  try {
    const analysisResult = await analyzeCaptureTaste({
      assetPath: savedAssetPath,
      sourceType: source.type,
      sourceUrl: source.type === 'url' ? source.normalizedUrl : null,
      userNote: metadata.userNote,
      tags: metadata.tags,
      whyLiked: metadata.whyLiked,
      styleCues: metadata.styleCues,
      facets: normalizedFacets,
      observedEvidence: record.pageInsights,
    });

    if (analysisResult) {
      applyTasteAnalysis(record, analysisResult.tasteAnalysis);

      try {
        const designPaths = await writeReferenceDesignArtifacts({
          libraryRoot,
          record,
          extraction: analysisResult.designSystemExtraction,
        });
        applyDesignExtraction(record, {
          extraction: analysisResult.designSystemExtraction,
          designPaths,
        });
      } catch (error) {
        record.designExtractionStatus = 'failed';
        record.designExtractionError = error.message;
      }

      try {
        const profileUpdate = await updateTasteProfiles({
          localLibraryRoot: libraryRoot,
          globalLibraryRoot: globalProfileRoot,
          currentRecord: record,
        });
        localProfilePath = profileUpdate.localProfilePath;
        globalProfilePath = profileUpdate.globalProfilePath;
        profileUpdateStatus = profileUpdate.profileUpdateStatus;
        profileUpdateError = profileUpdate.profileUpdateErrors?.global || profileUpdate.profileUpdateErrors?.local || null;
        if (profileUpdateError) {
          record.analysisError = `Profile update failed: ${profileUpdateError}`;
        }
      } catch (error) {
        profileUpdateStatus = {
          local: 'failed',
          global: 'failed',
        };
        profileUpdateError = error.message;
        record.analysisError = `Profile update failed: ${error.message}`;
      }
    } else {
      record.analysisStatus = 'pending';
      record.designExtractionStatus = 'pending';
    }
  } catch (error) {
    record.analysisStatus = 'failed';
    record.analysisError = error.message;
    record.designExtractionStatus = 'failed';
    record.designExtractionError = error.message;
  }

  await appendIndexEntry(indexPath, record);

  return buildCaptureResponse({
    record,
    savedAssetPath,
    indexPath,
    resolvedDestination: libraryRoot,
    warning: destination.warning,
    localProfilePath,
    globalProfilePath,
    profileUpdateStatus,
    profileUpdateError,
  });
}

export async function saveInspirationToMoodboard(args) {
  return captureTaste(args);
}

export async function saveWebsiteToMoodboard({
  url,
  destinationPath,
  workspaceRoot,
  tags,
  whyLiked,
  styleCues,
  userNote,
  facets,
}) {
  const result = await captureTaste({
    url,
    destinationPath,
    workspaceRoot,
    tags,
    whyLiked,
    styleCues,
    userNote,
    facets,
  });

  return {
    ...result,
    savedImagePath: result.savedAssetPath,
    url: result.record.sourceUrl,
  };
}

export async function extractDesignSystem({
  recordId,
  destinationPath,
  workspaceRoot,
  facets,
  force,
}) {
  if (!recordId || typeof recordId !== 'string') {
    throw new Error('A non-empty recordId is required.');
  }

  const rootHint = resolveWorkspaceHint(workspaceRoot);
  const destination = await resolveDestination({
    destinationPath,
    workspaceRoot: rootHint,
  });
  const libraryRoot = destination.resolvedPath;
  const indexPath = path.join(libraryRoot, libraryIndexFilename);
  const records = await readLibraryRecords(indexPath);
  const recordIndex = records.findIndex((item) => item?.id === recordId);

  if (recordIndex === -1) {
    throw new Error(`Record not found: ${recordId}`);
  }

  const record = records[recordIndex];
  const normalizedFacets = normalizeDesignFacets(facets || record.designFacets);
  const designPaths = getReferenceDesignPaths({
    libraryRoot,
    recordId,
  });

  if (
    !force &&
    record.designExtractionStatus === 'complete' &&
    sameStringSet(record.designFacets, normalizedFacets) &&
    await fileExists(record.designSystemJsonPath || designPaths.designSystemJsonPath) &&
    await fileExists(record.designMdPath || designPaths.designMdPath)
  ) {
    return {
      recordId,
      libraryRoot,
      designSystemJsonPath: record.designSystemJsonPath || designPaths.designSystemJsonPath,
      designMdPath: record.designMdPath || designPaths.designMdPath,
      facets: normalizedFacets,
      status: 'complete',
      interestingRegions: Array.isArray(record.interestingRegions) ? record.interestingRegions : [],
      warning: destination.warning,
    };
  }

  const assetPath = path.join(libraryRoot, assetsDirectoryName, record.assetFilename);
  if (!await fileExists(assetPath)) {
    throw new Error(`Saved asset not found for record ${recordId}: ${assetPath}`);
  }

  try {
    const analysisResult = await analyzeCaptureTaste({
      assetPath,
      sourceType: record.sourceType,
      sourceUrl: record.sourceUrl,
      userNote: record.userNote,
      tags: record.tags,
      whyLiked: record.whyLiked,
      styleCues: record.styleCues,
      facets: normalizedFacets,
      observedEvidence: record.pageInsights,
    });

    if (!analysisResult) {
      record.designExtractionStatus = 'pending';
      record.designFacets = normalizedFacets;
      record.designExtractionError = null;
    } else {
      const writtenPaths = await writeReferenceDesignArtifacts({
        libraryRoot,
        record,
        extraction: analysisResult.designSystemExtraction,
      });
      applyDesignExtraction(record, {
        extraction: analysisResult.designSystemExtraction,
        designPaths: writtenPaths,
      });
    }
  } catch (error) {
    record.designExtractionStatus = 'failed';
    record.designFacets = normalizedFacets;
    record.designExtractionError = error.message;
  }

  records[recordIndex] = record;
  await writeLibraryRecords(indexPath, records);

  return {
    recordId,
    libraryRoot,
    designSystemJsonPath: record.designSystemJsonPath,
    designMdPath: record.designMdPath,
    facets: record.designFacets,
    status: record.designExtractionStatus,
    interestingRegions: record.interestingRegions,
    error: record.designExtractionError,
    warning: destination.warning,
  };
}

async function resolveSourceInput({ url, localImagePath }) {
  const hasUrl = typeof url === 'string' && url.trim().length > 0;
  const hasLocalImage = typeof localImagePath === 'string' && localImagePath.trim().length > 0;

  if (hasUrl === hasLocalImage) {
    throw new Error('Provide exactly one of "url" or "localImagePath".');
  }

  if (hasUrl) {
    return {
      type: 'url',
      normalizedUrl: normalizeUrl(url),
    };
  }

  const absolutePath = await normalizeLocalImagePath(localImagePath);
  return {
    type: 'local-image',
    absolutePath,
    extension: path.extname(absolutePath).toLowerCase(),
    originalBasename: path.basename(absolutePath, path.extname(absolutePath)),
  };
}

export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('A non-empty URL string is required.');
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

async function normalizeLocalImagePath(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('A non-empty local image path string is required.');
  }

  const absolutePath = path.resolve(input);
  const extension = path.extname(absolutePath).toLowerCase();

  if (!supportedLocalImageExtensions.has(extension)) {
    throw new Error(`Unsupported local image extension: ${extension || '(none)'}`);
  }

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    throw new Error(`Local image file not found: ${absolutePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Local image path is not a file: ${absolutePath}`);
  }

  return absolutePath;
}

function normalizeMetadata({ tags, whyLiked, styleCues, userNote }) {
  return {
    tags: normalizeStringArray(tags),
    whyLiked: normalizeOptionalText(whyLiked),
    styleCues: normalizeStringArray(styleCues),
    userNote: normalizeOptionalText(userNote),
  };
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = [];
  for (const value of input) {
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

function normalizeOptionalText(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  return trimmed || null;
}

function buildBaseLibraryRecord({
  source,
  destinationPath,
  assetFilename,
  timestamp,
  metadata,
  facets,
  pageInsights,
}) {
  /** @type {MoodboardRecord} */
  const record = {
    id: randomUUID(),
    createdAt: timestamp.toISOString(),
    sourceType: source.type,
    sourceUrl: source.type === 'url' ? source.normalizedUrl : null,
    sourcePath: source.type === 'local-image' ? source.absolutePath : null,
    assetFilename,
    resolvedDestination: destinationPath,
    tags: metadata.tags,
    whyLiked: metadata.whyLiked,
    styleCues: metadata.styleCues,
    userNote: metadata.userNote,
    analysisStatus: 'pending',
    visualTraits: null,
    whyItWorks: null,
    designSignals: [],
    profileContributions: null,
    tasteAnalysis: null,
    analysisError: null,
    designExtractionStatus: 'pending',
    designSystemJsonPath: null,
    designMdPath: null,
    designFacets: facets,
    interestingRegions: [],
    designExtractionError: null,
    pageInsights: pageInsights || null,
  };

  return record;
}

function applyTasteAnalysis(record, tasteAnalysis) {
  record.analysisStatus = 'complete';
  record.visualTraits = tasteAnalysis.visualTraits;
  record.whyItWorks = tasteAnalysis.whyItWorks;
  record.designSignals = tasteAnalysis.designSignals;
  record.profileContributions = tasteAnalysis.profileContributions;
  record.tasteAnalysis = tasteAnalysis;
  record.analysisError = null;
}

function applyDesignExtraction(record, { extraction, designPaths }) {
  record.designExtractionStatus = 'complete';
  record.designSystemJsonPath = designPaths.designSystemJsonPath;
  record.designMdPath = designPaths.designMdPath;
  record.designFacets = Array.isArray(extraction.facets) ? extraction.facets : record.designFacets;
  record.interestingRegions = Array.isArray(extraction.interestingRegions) ? extraction.interestingRegions : [];
  record.designExtractionError = null;
}

function buildCaptureResponse({
  record,
  savedAssetPath,
  indexPath,
  resolvedDestination,
  warning,
  localProfilePath,
  globalProfilePath,
  profileUpdateStatus,
  profileUpdateError,
}) {
  return {
    recordId: record.id,
    savedAssetPath,
    indexPath,
    resolvedDestination,
    warning,
    analysisStatus: record.analysisStatus,
    tasteAnalysis: record.tasteAnalysis,
    localProfilePath,
    globalProfilePath,
    profileUpdateStatus,
    profileUpdateError,
    designExtractionStatus: record.designExtractionStatus,
    designSystemJsonPath: record.designSystemJsonPath,
    designMdPath: record.designMdPath,
    designFacets: record.designFacets,
    interestingRegions: record.interestingRegions,
    designExtractionError: record.designExtractionError,
    record,
  };
}

export function resolveWorkspaceHint(explicitWorkspaceRoot) {
  if (explicitWorkspaceRoot) {
    return path.resolve(explicitWorkspaceRoot);
  }

  const envCandidates = [
    process.env.MOODBOARD_CAPTURE_WORKSPACE_ROOT,
    process.env.CODEX_WORKSPACE_ROOT,
    process.env.INIT_CWD,
    process.env.PWD,
    process.cwd(),
  ].filter(Boolean).map((candidate) => path.resolve(candidate));

  const filtered = envCandidates.filter((candidate, index) => {
    return envCandidates.indexOf(candidate) === index && !candidate.startsWith(pluginRoot);
  });

  return filtered[0] || null;
}

async function resolveDestination({ destinationPath, workspaceRoot }) {
  if (destinationPath) {
    const resolvedPath = path.isAbsolute(destinationPath)
      ? destinationPath
      : path.resolve(workspaceRoot || process.cwd(), destinationPath);
    return {
      resolvedPath,
      warning: null,
    };
  }

  return {
    resolvedPath: globalFallback,
    warning: 'Used the default moodboard inbox because no explicit destinationPath was provided.',
  };
}

async function resolveGlobalProfileRoot({ localLibraryRoot }) {
  return localLibraryRoot;
}

async function capturePage(url, outputPath) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: {
        width: desktopViewport.width,
        height: desktopViewport.height,
      },
      deviceScaleFactor: desktopViewport.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const pageInsights = await collectPageInsights(page).catch(() => null);
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
    });
    await context.close();
    return pageInsights;
  } catch (error) {
    throw new Error(`Failed to capture screenshot: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function copyLocalImage(sourcePath, outputPath) {
  try {
    await fs.copyFile(sourcePath, outputPath);
  } catch (error) {
    throw new Error(`Failed to save local image: ${error.message}`);
  }
}

async function appendIndexEntry(indexPath, entry) {
  const payload = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(indexPath, payload, 'utf8');
}

function buildAssetFileName(source, timestamp) {
  if (source.type === 'url') {
    return buildWebsiteFileName(source.normalizedUrl, timestamp);
  }

  const baseName = sanitizeSegment(source.originalBasename) || 'inspiration';
  return `${formatTimestamp(timestamp)}-${baseName}${source.extension}`;
}

function buildWebsiteFileName(rawUrl, timestamp) {
  const parsed = new URL(rawUrl);
  const host = sanitizeSegment(parsed.hostname || 'local');
  const slug = buildUrlSlug(parsed);
  return `${formatTimestamp(timestamp)}-${host}-${slug}.png`;
}

function buildUrlSlug(parsedUrl) {
  const source = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';
  const cleaned = sanitizeSegment(source);
  if (cleaned && cleaned !== '-') {
    return cleaned.slice(0, 80);
  }
  return 'homepage';
}

function sanitizeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function fileExists(filePath) {
  if (!filePath) {
    return false;
  }
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sameStringSet(left, right) {
  const leftValues = Array.isArray(left) ? [...left].sort() : [];
  const rightValues = Array.isArray(right) ? [...right].sort() : [];
  if (leftValues.length !== rightValues.length) {
    return false;
  }
  return leftValues.every((value, index) => value === rightValues[index]);
}
