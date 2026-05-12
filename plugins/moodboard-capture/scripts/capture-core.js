#!/usr/bin/env node

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const globalFallback = path.join(os.homedir(), 'Documents', 'Moodboards', 'Inbox');

const desktopViewport = {
  width: 1440,
  height: 1100,
  deviceScaleFactor: 2,
};

export async function saveWebsiteToMoodboard({
  url,
  destinationPath,
  workspaceRoot,
}) {
  const normalizedUrl = normalizeUrl(url);
  const rootHint = resolveWorkspaceHint(workspaceRoot);
  const destination = await resolveDestination({
    destinationPath,
    workspaceRoot: rootHint,
  });

  await fs.mkdir(destination.resolvedPath, { recursive: true });

  const timestamp = new Date();
  const fileName = buildFileName(normalizedUrl, timestamp);
  const imagePath = path.join(destination.resolvedPath, fileName);
  const indexPath = path.join(destination.resolvedPath, 'captures.jsonl');

  await capturePage(normalizedUrl, imagePath);
  await appendIndexEntry(indexPath, {
    timestamp: timestamp.toISOString(),
    url: normalizedUrl,
    resolvedDestination: destination.resolvedPath,
    imageFilename: fileName,
  });

  return {
    url: normalizedUrl,
    savedImagePath: imagePath,
    indexPath,
    resolvedDestination: destination.resolvedPath,
    warning: destination.warning,
  };
}

export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('A non-empty URL string is required.');
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch (error) {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
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

async function appendIndexEntry(indexPath, entry) {
  const payload = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(indexPath, payload, 'utf8');
}

function buildFileName(rawUrl, timestamp) {
  const parsed = new URL(rawUrl);
  const host = sanitizeSegment(parsed.hostname || 'local');
  const slug = buildSlug(parsed);
  return `${formatTimestamp(timestamp)}-${host}-${slug}.png`;
}

function buildSlug(parsedUrl) {
  const source = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';
  const cleaned = sanitizeSegment(source);
  if (cleaned && cleaned !== '-') {
    return cleaned.slice(0, 80);
  }
  return 'homepage';
}

function sanitizeSegment(value) {
  return value
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
