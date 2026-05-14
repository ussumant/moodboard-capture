#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  captureTaste,
  extractDesignSystem,
  saveInspirationToMoodboard,
  saveWebsiteToMoodboard,
} from './capture-core.js';
import { summarizeTaste } from './taste-summary.js';
import {
  generateTasteVisuals,
  visualizeTaste,
} from './taste-visuals.js';
import {
  deriveDesignDirections,
  planLandingPage,
} from './landing-page-workflow.js';

const server = new Server(
  {
    name: 'moodboard-capture',
    version: '0.5.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const facetSchema = {
  type: 'array',
  items: {
    type: 'string',
    enum: ['colors', 'typography', 'layout', 'components', 'imagery', 'motion', 'dos-donts'],
  },
  description: 'Optional facet focus list for design-system extraction.',
};

const captureProperties = {
  destinationPath: {
    type: 'string',
    description: 'Optional absolute or workspace-relative library root override.',
  },
  tags: {
    type: 'array',
    items: {
      type: 'string',
    },
    description: 'Optional retrieval tags such as editorial, soft gradients, or dense grid.',
  },
  whyLiked: {
    type: 'string',
    description: 'Optional short note describing what you liked about this inspiration.',
  },
  styleCues: {
    type: 'array',
    items: {
      type: 'string',
    },
    description: 'Optional design direction cues such as muted palette or oversized serif.',
  },
  userNote: {
    type: 'string',
    description: 'Optional short human note describing what stands out or why the reference matters.',
  },
  facets: facetSchema,
};

const referenceIdsSchema = {
  type: 'array',
  items: {
    type: 'string',
  },
  description: 'Optional saved record ids to narrow synthesis to a specific subset of references.',
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'capture_taste',
        description: 'Capture a website or local image into the taste library, analyze it, generate per-reference design docs, and update the active taste profile.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: {
              type: 'string',
              description: 'The http, https, or file URL to capture as a full-page screenshot.',
            },
            localImagePath: {
              type: 'string',
              description: 'Absolute or current-working-directory-relative path to a local image to import.',
            },
            ...captureProperties,
          },
        },
      },
      {
        name: 'extract_design_system',
        description: 'Re-run or refine design-system extraction for an existing saved record and regenerate design-system.json plus design.md.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recordId: {
              type: 'string',
              description: 'The saved moodboard record id to extract against.',
            },
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            facets: facetSchema,
            force: {
              type: 'boolean',
              description: 'When true, regenerate extraction artifacts even if matching artifacts already exist.',
            },
          },
          required: ['recordId'],
        },
      },
      {
        name: 'summarize_taste',
        description: 'Summarize the active taste library into stable preferences, anti-patterns, tensions, branch directions, and a library-level design system.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            profilePath: {
              type: 'string',
              description: 'Optional explicit path to a taste-profile.json file.',
            },
          },
        },
      },
      {
        name: 'visualize_taste',
        description: 'Generate visual moodboards from the active taste summary and, when available, direction-level design artifacts in one or more named directions.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            summaryPath: {
              type: 'string',
              description: 'Optional explicit path to a taste-summary.json file.',
            },
            directions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['infra-editorial', 'warm-technical', 'strange-systems'],
              },
              description: 'Optional list of visual directions to render. Defaults to all three.',
            },
          },
        },
      },
      {
        name: 'derive_design_directions',
        description: 'Turn the active moodboard library into 2-3 structured landing-page-ready design directions backed by extracted reference evidence.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            referenceIds: referenceIdsSchema,
            directionCount: {
              type: 'integer',
              enum: [2, 3],
              description: 'Optional number of directions to generate. Defaults to all three starter directions.',
            },
          },
        },
      },
      {
        name: 'plan_landing_page',
        description: 'Turn a chosen design direction into a build-ready landing-page brief plus provenance artifacts.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            directionId: {
              type: 'string',
              enum: ['infra-editorial', 'warm-technical', 'strange-systems'],
              description: 'The direction id to turn into a landing-page brief.',
            },
            referenceIds: referenceIdsSchema,
            targetAudience: {
              type: 'string',
              description: 'Optional audience framing for the landing-page brief.',
            },
            productGoal: {
              type: 'string',
              description: 'Optional product or page goal to emphasize in the landing-page brief.',
            },
          },
          required: ['directionId'],
        },
      },
      {
        name: 'save_inspiration_to_moodboard',
        description: 'Compatibility alias for capture_taste.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: {
              type: 'string',
              description: 'The http, https, or file URL to capture as a full-page screenshot.',
            },
            localImagePath: {
              type: 'string',
              description: 'Absolute or current-working-directory-relative path to a local image to import.',
            },
            ...captureProperties,
          },
        },
      },
      {
        name: 'save_website_to_moodboard',
        description: 'Compatibility alias for website-only capture.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: {
              type: 'string',
              description: 'The http, https, or file URL to capture as a full-page screenshot.',
            },
            ...captureProperties,
          },
          required: ['url'],
        },
      },
      {
        name: 'generate_taste_visuals',
        description: 'Compatibility alias for visualize_taste.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative library root override.',
            },
            summaryPath: {
              type: 'string',
              description: 'Optional explicit path to a taste-summary.json file.',
            },
            profilePath: {
              type: 'string',
              description: 'Optional explicit path to a taste-profile.json file for compatibility.',
            },
            directions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['infra-editorial', 'warm-technical', 'strange-systems'],
              },
              description: 'Optional list of visual directions to render. Defaults to all three.',
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;

    if (name === 'capture_taste') {
      result = await captureTaste({
        url: args.url,
        localImagePath: args.localImagePath,
        destinationPath: args.destinationPath,
        tags: args.tags,
        whyLiked: args.whyLiked,
        styleCues: args.styleCues,
        userNote: args.userNote,
        facets: args.facets,
      });
    } else if (name === 'extract_design_system') {
      result = await extractDesignSystem({
        recordId: args.recordId,
        destinationPath: args.destinationPath,
        facets: args.facets,
        force: args.force,
      });
    } else if (name === 'summarize_taste') {
      result = await summarizeTaste({
        destinationPath: args.destinationPath,
        profilePath: args.profilePath,
      });
    } else if (name === 'visualize_taste') {
      result = await visualizeTaste({
        destinationPath: args.destinationPath,
        summaryPath: args.summaryPath,
        directions: args.directions,
      });
    } else if (name === 'derive_design_directions') {
      result = await deriveDesignDirections({
        destinationPath: args.destinationPath,
        referenceIds: args.referenceIds,
        directionCount: args.directionCount,
      });
    } else if (name === 'plan_landing_page') {
      result = await planLandingPage({
        destinationPath: args.destinationPath,
        directionId: args.directionId,
        referenceIds: args.referenceIds,
        targetAudience: args.targetAudience,
        productGoal: args.productGoal,
      });
    } else if (name === 'save_inspiration_to_moodboard') {
      result = await saveInspirationToMoodboard({
        url: args.url,
        localImagePath: args.localImagePath,
        destinationPath: args.destinationPath,
        tags: args.tags,
        whyLiked: args.whyLiked,
        styleCues: args.styleCues,
        userNote: args.userNote,
        facets: args.facets,
      });
    } else if (name === 'save_website_to_moodboard') {
      result = await saveWebsiteToMoodboard({
        url: args.url,
        destinationPath: args.destinationPath,
        tags: args.tags,
        whyLiked: args.whyLiked,
        styleCues: args.styleCues,
        userNote: args.userNote,
        facets: args.facets,
      });
    } else if (name === 'generate_taste_visuals') {
      result = await generateTasteVisuals({
        destinationPath: args.destinationPath,
        summaryPath: args.summaryPath,
        profilePath: args.profilePath,
        directions: args.directions,
      });
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
