#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

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
 * Normalized inspiration record persisted in the moodboard library index.
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
 */

export async function saveInspirationToMoodboard({
  url,
  localImagePath,
  destinationPath,
  workspaceRoot,
  tags,
  whyLiked,
  styleCues,
}) {
  const source = await resolveSourceInput({ url, localImagePath });
  const rootHint = resolveWorkspaceHint(workspaceRoot);
  const destination = await resolveDestination({
    destinationPath,
    workspaceRoot: rootHint,
  });

  const libraryRoot = destination.resolvedPath;
  const assetsPath = path.join(libraryRoot, assetsDirectoryName);
  const timestamp = new Date();
  const metadata = normalizeMetadata({ tags, whyLiked, styleCues });
  const assetFilename = buildAssetFileName(source, timestamp);
  const savedAssetPath = path.join(assetsPath, assetFilename);
  const indexPath = path.join(libraryRoot, libraryIndexFilename);
  const record = buildLibraryRecord({
    source,
    destinationPath: libraryRoot,
    assetFilename,
    timestamp,
    metadata,
  });

  await fs.mkdir(assetsPath, { recursive: true });

  if (source.type === 'url') {
    await capturePage(source.normalizedUrl, savedAssetPath);
  } else {
    await copyLocalImage(source.absolutePath, savedAssetPath);
  }

  await appendIndexEntry(indexPath, record);

  return {
    recordId: record.id,
    savedAssetPath,
    indexPath,
    resolvedDestination: libraryRoot,
    warning: destination.warning,
    record,
  };
}

export async function saveWebsiteToMoodboard({
  url,
  destinationPath,
  workspaceRoot,
  tags,
  whyLiked,
  styleCues,
}) {
  const result = await saveInspirationToMoodboard({
    url,
    destinationPath,
    workspaceRoot,
    tags,
    whyLiked,
    styleCues,
  });

  return {
    ...result,
    savedImagePath: result.savedAssetPath,
    url: result.record.sourceUrl,
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

function normalizeMetadata({ tags, whyLiked, styleCues }) {
  return {
    tags: normalizeStringArray(tags),
    whyLiked: normalizeOptionalText(whyLiked),
    styleCues: normalizeStringArray(styleCues),
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

function buildLibraryRecord({
  source,
  destinationPath,
  assetFilename,
  timestamp,
  metadata,
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
  };

  return record;
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

  if (workspaceRoot) {
    const conventional = await resolveConventionalMoodboard(workspaceRoot);
    if (conventional) {
      return {
        resolvedPath: conventional,
        warning: null,
      };
    }

    const discovered = await findMoodboardDirectory(workspaceRoot);
    if (discovered) {
      return {
        resolvedPath: discovered,
        warning: 'Used the first discovered moodboard directory in the current workspace.',
      };
    }
  }

  return {
    resolvedPath: globalFallback,
    warning: 'No workspace moodboard directory was found, so the global fallback folder was used.',
  };
}

async function resolveConventionalMoodboard(workspaceRoot) {
  const bases = await existingAncestorChain(workspaceRoot);
  for (const base of bases) {
    const candidates = [
      path.join(base, 'Knowledge', 'Design', 'moodboard-assets'),
      path.join(base, 'Design', 'moodboard-assets'),
    ];

    for (const candidate of candidates) {
      if (await isDirectory(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function existingAncestorChain(startPath) {
  const chain = [];
  let current = path.resolve(startPath);

  while (true) {
    chain.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return chain;
}

async function findMoodboardDirectory(workspaceRoot) {
  const startPath = path.resolve(workspaceRoot);
  const queue = [{ dir: startPath, depth: 0 }];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current.dir)) {
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
      if (!entry.isDirectory()) {
        continue;
      }

      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(current.dir, entry.name);
      if (entry.name.toLowerCase().includes('moodboard')) {
        return fullPath;
      }

      if (current.depth < 4) {
        queue.push({ dir: fullPath, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

async function isDirectory(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
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
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
    });
    await context.close();
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
