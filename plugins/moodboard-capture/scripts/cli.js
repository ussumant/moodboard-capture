#!/usr/bin/env node

import { saveInspirationToMoodboard } from './capture-core.js';

const args = process.argv.slice(2);

try {
  const params = parseArgs(args);
  const result = await saveInspirationToMoodboard(params);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {
    tags: [],
    styleCues: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--url') {
      parsed.url = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--localImagePath') {
      parsed.localImagePath = argv[index + 1];
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

    if (token === '--tag') {
      parsed.tags.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--styleCue') {
      parsed.styleCues.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--whyLiked') {
      parsed.whyLiked = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!parsed.url && !parsed.localImagePath) {
    throw new Error(
      'Usage: node ./scripts/cli.js (--url <url> | --localImagePath <path>) [--destinationPath <path>] [--workspaceRoot <path>] [--tag <tag>] [--styleCue <cue>] [--whyLiked <note>]'
    );
  }

  return parsed;
}
