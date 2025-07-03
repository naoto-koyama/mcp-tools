#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
if (!GITHUB_PERSONAL_ACCESS_TOKEN) {
  console.error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_PERSONAL_ACCESS_TOKEN,
});

const server = new Server(
  {
    name: 'github-review-comment-reply-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools: Tool[] = [
  {
    name: 'reply_to_review_comment',
    description: 'Reply to a specific review comment on a GitHub pull request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner (username or organization)',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        pull_number: {
          type: 'number',
          description: 'Pull request number',
        },
        comment_id: {
          type: 'number',
          description: 'The ID of the review comment to reply to',
        },
        body: {
          type: 'string',
          description: 'The content of the reply',
        },
      },
      required: ['owner', 'repo', 'pull_number', 'comment_id', 'body'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'reply_to_review_comment': {
        const { owner, repo, pull_number, comment_id, body } = args as {
          owner: string;
          repo: string;
          pull_number: number;
          comment_id: number;
          body: string;
        };

        const response = await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo,
          pull_number,
          comment_id,
          body,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  body: response.data.body,
                  user: response.data.user?.login,
                  created_at: response.data.created_at,
                  html_url: response.data.html_url,
                },
                message: 'Reply to review comment created successfully',
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub Review Comment Reply MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 