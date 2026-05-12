#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { saveWebsiteToMoodboard } from './capture-core.js';

const server = new Server(
  {
    name: 'moodboard-capture',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'save_website_to_moodboard',
        description: 'Capture a desktop full-page screenshot for a URL and save it into the best available moodboard folder.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: {
              type: 'string',
              description: 'The http, https, or file URL to capture.',
            },
            destinationPath: {
              type: 'string',
              description: 'Optional absolute or workspace-relative folder path override.',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name !== 'save_website_to_moodboard') {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await saveWebsiteToMoodboard({
      url: args.url,
      destinationPath: args.destinationPath,
    });

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
