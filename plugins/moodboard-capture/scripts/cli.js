#!/usr/bin/env node

import { saveWebsiteToMoodboard } from './capture-core.js';

const args = process.argv.slice(2);
const params = parseArgs(args);

try {
  const result = await saveWebsiteToMoodboard(params);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--url') {
      parsed.url = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--destinationPath') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--workspaceRoot') {
      parsed.workspaceRoot = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!parsed.url) {
    throw new Error('Usage: node ./scripts/cli.js --url <url> [--destinationPath <path>] [--workspaceRoot <path>]');
  }

  return parsed;
}
