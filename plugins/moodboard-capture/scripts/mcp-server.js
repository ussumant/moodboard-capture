#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  saveInspirationToMoodboard,
  saveWebsiteToMoodboard,
} from './capture-core.js';

const server = new Server(
  {
    name: 'moodboard-capture',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const sharedProperties = {
  destinationPath: {
    type: 'string',
    description: 'Optional absolute or workspace-relative folder path override.',
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
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'save_inspiration_to_moodboard',
        description: 'Save either a website screenshot or a local image into the moodboard library with optional taste metadata.',
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
            ...sharedProperties,
          },
        },
      },
      {
        name: 'save_website_to_moodboard',
        description: 'Compatibility alias for saving a website screenshot into the moodboard library.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: {
              type: 'string',
              description: 'The http, https, or file URL to capture as a full-page screenshot.',
            },
            ...sharedProperties,
          },
          required: ['url'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;

    if (name === 'save_inspiration_to_moodboard') {
      result = await saveInspirationToMoodboard({
        url: args.url,
        localImagePath: args.localImagePath,
        destinationPath: args.destinationPath,
        tags: args.tags,
        whyLiked: args.whyLiked,
        styleCues: args.styleCues,
      });
    } else if (name === 'save_website_to_moodboard') {
      result = await saveWebsiteToMoodboard({
        url: args.url,
        destinationPath: args.destinationPath,
        tags: args.tags,
        whyLiked: args.whyLiked,
        styleCues: args.styleCues,
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
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error.message,
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
