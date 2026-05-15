#!/usr/bin/env node

import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { getBoardPaths } from './board-view.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const viewerRoot = path.join(pluginRoot, 'viewer');
const port = Number(process.env.MOODBOARD_CAPTURE_BOARD_PORT || 43119);

const vite = await createViteServer({
  root: viewerRoot,
  appType: 'spa',
  plugins: [react()],
  server: {
    middlewareMode: true,
  },
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

    if (url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'moodboard-board-viewer',
      });
      return;
    }

    if (url.pathname === '/api/board' && req.method === 'GET') {
      await handleBoardRequest(req, res, url);
      return;
    }

    if (url.pathname === '/api/asset' && req.method === 'GET') {
      await handleAssetRequest(req, res, url);
      return;
    }

    if (url.pathname === '/api/board/state' && req.method === 'POST') {
      await handleBoardStateSave(req, res, url);
      return;
    }

    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
});

server.listen(port, '127.0.0.1');

async function handleBoardRequest(_req, res, url) {
  const libraryRoot = resolveLibraryRoot(url);
  const boardPaths = getBoardPaths(libraryRoot);
  const manifest = await readJson(boardPaths.boardManifestPath);

  const enrichedItems = (manifest.items || []).map((item) => ({
    ...item,
    assetUrl: item.assetPath
      ? buildAssetUrl({
          libraryRoot,
          assetPath: item.assetPath,
        })
      : null,
  }));

  sendJson(res, 200, {
    libraryRoot,
    manifest: {
      ...manifest,
      items: enrichedItems,
      backgroundUrl: buildAssetUrl({
        libraryRoot,
        assetPath: manifest.backgroundAssetPath,
      }),
    },
    readOnly: true,
  });
}

async function handleAssetRequest(_req, res, url) {
  const libraryRoot = resolveLibraryRoot(url);
  const encodedPath = url.searchParams.get('path');
  if (!encodedPath) {
    sendJson(res, 400, { error: 'Missing asset path.' });
    return;
  }

  const assetPath = path.resolve(encodedPath);
  if (!isSafeLibraryPath(assetPath, libraryRoot)) {
    sendJson(res, 403, { error: 'Asset path is outside the active library.' });
    return;
  }

  let payload;
  try {
    payload = await fs.readFile(assetPath);
  } catch {
    sendJson(res, 404, { error: 'Asset not found.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': detectMimeType(assetPath),
    'Cache-Control': 'no-cache',
  });
  res.end(payload);
}

async function handleBoardStateSave(req, res, url) {
  const libraryRoot = resolveLibraryRoot(url);
  const body = await readJsonBody(req);
  const boardPaths = getBoardPaths(libraryRoot);

  const nextState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    libraryRoot,
    snapshot: body?.snapshot || null,
  };

  await fs.mkdir(boardPaths.boardRoot, { recursive: true });
  await fs.writeFile(boardPaths.boardStatePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  sendJson(res, 200, {
    ok: true,
    boardStatePath: boardPaths.boardStatePath,
  });
}

function resolveLibraryRoot(url) {
  const libraryRoot = url.searchParams.get('libraryRoot');
  if (!libraryRoot) {
    throw new Error('Missing libraryRoot.');
  }

  const resolved = path.resolve(libraryRoot);
  if (!path.isAbsolute(resolved)) {
    throw new Error('libraryRoot must resolve to an absolute path.');
  }
  return resolved;
}

function buildAssetUrl({ libraryRoot, assetPath }) {
  return `/api/asset?libraryRoot=${encodeURIComponent(libraryRoot)}&path=${encodeURIComponent(assetPath)}`;
}

function isSafeLibraryPath(candidatePath, libraryRoot) {
  const normalizedRoot = `${path.resolve(libraryRoot)}${path.sep}`;
  const normalizedCandidate = path.resolve(candidatePath);
  return normalizedCandidate === path.resolve(libraryRoot) || normalizedCandidate.startsWith(normalizedRoot);
}

function detectMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}
