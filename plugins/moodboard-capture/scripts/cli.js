#!/usr/bin/env node

import {
  extractDesignSystem,
  saveInspirationToMoodboard,
} from './capture-core.js';
import {
  deriveDesignDirections,
  planLandingPage,
} from './landing-page-workflow.js';
import { openMoodboardBoard } from './board-view.js';
import { summarizeTaste } from './taste-summary.js';
import { visualizeTaste } from './taste-visuals.js';

const args = process.argv.slice(2);

try {
  const { command, argv } = splitCommand(args);
  const result = await runCommand(command, argv);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
}

async function runCommand(command, argv) {
  if (command === 'extract-design-system') {
    const parsed = parseExtractArgs(argv);
    return extractDesignSystem(parsed);
  }

  if (command === 'summarize-taste') {
    const parsed = parseSummaryArgs(argv);
    return summarizeTaste(parsed);
  }

  if (command === 'visualize-taste') {
    const parsed = parseVisualizeArgs(argv);
    return visualizeTaste(parsed);
  }

  if (command === 'derive-design-directions') {
    const parsed = parseDirectionArgs(argv);
    return deriveDesignDirections(parsed);
  }

  if (command === 'plan-landing-page') {
    const parsed = parseLandingPageArgs(argv);
    return planLandingPage(parsed);
  }

  if (command === 'open-moodboard-board') {
    const parsed = parseBoardArgs(argv);
    return openMoodboardBoard(parsed);
  }

  const parsed = parseCaptureArgs(argv);
  return saveInspirationToMoodboard(parsed);
}

function splitCommand(argv) {
  const [first, ...rest] = argv;
  if (!first || first.startsWith('--')) {
    return {
      command: 'capture',
      argv,
    };
  }

  const normalized = first.trim().toLowerCase();
  if (['capture', 'extract-design-system', 'summarize-taste', 'visualize-taste', 'derive-design-directions', 'plan-landing-page', 'open-moodboard-board'].includes(normalized)) {
    return {
      command: normalized,
      argv: rest,
    };
  }

  return {
    command: 'capture',
    argv,
  };
}

function parseCaptureArgs(argv) {
  const parsed = {
    tags: [],
    styleCues: [],
    facets: [],
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

    if (token === '--userNote') {
      parsed.userNote = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--facet') {
      parsed.facets.push(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  if (!parsed.url && !parsed.localImagePath) {
    throw new Error(
      'Usage: node ./scripts/cli.js [capture] (--url <url> | --localImagePath <path>) [--destinationPath <path>] [--workspaceRoot <path>] [--tag <tag>] [--styleCue <cue>] [--whyLiked <note>] [--userNote <note>] [--facet <facet>]'
    );
  }

  return parsed;
}

function parseExtractArgs(argv) {
  const parsed = {
    facets: [],
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--recordId') {
      parsed.recordId = argv[index + 1];
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

    if (token === '--facet') {
      parsed.facets.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--force') {
      parsed.force = true;
    }
  }

  if (!parsed.recordId) {
    throw new Error(
      'Usage: node ./scripts/cli.js extract-design-system --recordId <id> [--destinationPath <path>] [--workspaceRoot <path>] [--facet <facet>] [--force]'
    );
  }

  return parsed;
}

function parseSummaryArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--destinationPath') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--profilePath') {
      parsed.profilePath = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function parseVisualizeArgs(argv) {
  const parsed = {
    directions: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--destinationPath') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--summaryPath') {
      parsed.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--direction') {
      parsed.directions.push(argv[index + 1]);
      index += 1;
    }
  }

  return parsed;
}

function parseDirectionArgs(argv) {
  const parsed = {
    referenceIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--destinationPath') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--referenceId') {
      parsed.referenceIds.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--directionCount') {
      parsed.directionCount = Number(argv[index + 1]);
      index += 1;
    }
  }

  return parsed;
}

function parseLandingPageArgs(argv) {
  const parsed = {
    referenceIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--destinationPath') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--directionId') {
      parsed.directionId = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--referenceId') {
      parsed.referenceIds.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--targetAudience') {
      parsed.targetAudience = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--productGoal') {
      parsed.productGoal = argv[index + 1];
      index += 1;
    }
  }

  if (!parsed.directionId) {
    throw new Error(
      'Usage: node ./scripts/cli.js plan-landing-page --directionId <infra-editorial|warm-technical|strange-systems> [--destinationPath <path>] [--referenceId <id>] [--targetAudience <text>] [--productGoal <text>]'
    );
  }

  return parsed;
}

function parseBoardArgs(argv) {
  const parsed = {
    resetLayout: false,
    regenerateBackground: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--destinationPath' || token === '--destination-path') {
      parsed.destinationPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--resetLayout' || token === '--reset-layout') {
      parsed.resetLayout = true;
      continue;
    }

    if (token === '--regenerateBackground' || token === '--regenerate-background') {
      parsed.regenerateBackground = true;
    }
  }

  return parsed;
}
