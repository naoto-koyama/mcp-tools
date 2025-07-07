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
    name: 'github-review-comment-reply-resolve-mcp',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to get thread ID from comment ID
async function getThreadIdFromComment(owner: string, repo: string, commentId: number): Promise<string> {
  // First, get the comment details using REST API
  const comment = await octokit.rest.pulls.getReviewComment({
    owner,
    repo,
    comment_id: commentId,
  });

  // Try to find the thread ID from the comment data
  // If the comment has in_reply_to_id, it means it's a reply to another comment
  // We need to get the original comment to find the thread
  let originalCommentId = commentId;
  if (comment.data.in_reply_to_id) {
    originalCommentId = comment.data.in_reply_to_id;
  }

  // For GitHub GraphQL API, we need to construct the thread ID
  // Thread IDs in GitHub GraphQL typically follow the pattern: PRRT_<base64-encoded-data>
  // However, since we can't directly get the thread ID from REST API,
  // we'll use the GraphQL API to search for the thread
  
  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          reviewThreads(first: 100) {
            nodes {
              id
              comments(first: 100) {
                nodes {
                  databaseId
                }
              }
            }
          }
        }
      }
    }
  `;

  // Extract PR number from the pull_request_url
  const prNumber = parseInt(comment.data.pull_request_url.split('/').pop() || '0');
  
  const response: any = await octokit.graphql(query, {
    owner,
    repo,
    prNumber,
  });

  // Find the thread that contains our comment
  const threads = response.repository?.pullRequest?.reviewThreads?.nodes || [];
  for (const thread of threads) {
    const commentIds = thread.comments?.nodes?.map((c: any) => c.databaseId) || [];
    if (commentIds.includes(originalCommentId) || commentIds.includes(commentId)) {
      return thread.id;
    }
  }

  throw new Error(`Could not find thread for comment ${commentId}`);
}

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
  {
    name: 'resolve_review_thread',
    description: 'Resolve a review comment thread on a GitHub pull request',
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
        thread_id: {
          type: 'string',
          description: 'The GraphQL ID of the review thread (optional if comment_id is provided)',
        },
        comment_id: {
          type: 'number',
          description: 'The REST API ID of any comment in the thread (optional if thread_id is provided)',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'unresolve_review_thread',
    description: 'Unresolve a previously resolved review comment thread on a GitHub pull request',
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
        thread_id: {
          type: 'string',
          description: 'The GraphQL ID of the review thread (optional if comment_id is provided)',
        },
        comment_id: {
          type: 'number',
          description: 'The REST API ID of any comment in the thread (optional if thread_id is provided)',
        },
      },
      required: ['owner', 'repo'],
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

      case 'resolve_review_thread': {
        const { owner, repo, thread_id, comment_id } = args as {
          owner: string;
          repo: string;
          thread_id?: string;
          comment_id?: number;
        };

        // Validate that at least one of thread_id or comment_id is provided
        if (!thread_id && !comment_id) {
          throw new Error('Either thread_id or comment_id must be provided');
        }

        let threadId = thread_id;

        // If thread_id is not provided, get it from comment_id
        if (!threadId && comment_id) {
          threadId = await getThreadIdFromComment(owner, repo, comment_id);
        }

        // Resolve the thread using GraphQL mutation
        const mutation = `
          mutation($threadId: ID!) {
            resolveReviewThread(input: { threadId: $threadId }) {
              thread {
                id
                isResolved
                resolvedBy {
                  login
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(mutation, {
          threadId,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                thread: {
                  id: result.resolveReviewThread.thread.id,
                  isResolved: result.resolveReviewThread.thread.isResolved,
                  resolvedBy: result.resolveReviewThread.thread.resolvedBy?.login,
                },
                message: 'Review thread resolved successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'unresolve_review_thread': {
        const { owner, repo, thread_id, comment_id } = args as {
          owner: string;
          repo: string;
          thread_id?: string;
          comment_id?: number;
        };

        // Validate that at least one of thread_id or comment_id is provided
        if (!thread_id && !comment_id) {
          throw new Error('Either thread_id or comment_id must be provided');
        }

        let threadId = thread_id;

        // If thread_id is not provided, get it from comment_id
        if (!threadId && comment_id) {
          threadId = await getThreadIdFromComment(owner, repo, comment_id);
        }

        // Unresolve the thread using GraphQL mutation
        const mutation = `
          mutation($threadId: ID!) {
            unresolveReviewThread(input: { threadId: $threadId }) {
              thread {
                id
                isResolved
              }
            }
          }
        `;

        const result: any = await octokit.graphql(mutation, {
          threadId,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                thread: {
                  id: result.unresolveReviewThread.thread.id,
                  isResolved: result.unresolveReviewThread.thread.isResolved,
                },
                message: 'Review thread unresolved successfully',
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
  console.error('GitHub Review Comment Reply & Resolve MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 