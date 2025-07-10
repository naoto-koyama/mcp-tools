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
    version: '1.2.1',
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
    name: 'get_pr_comments',
    description: 'Get pull request review comments with their thread resolution status',
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
        per_page: {
          type: 'number',
          description: 'Number of results per page (max 100)',
          default: 30,
        },
        page: {
          type: 'number',
          description: 'Page number of the results',
          default: 1,
        },
        resolved_status: {
          type: 'string',
          enum: ['all', 'resolved', 'unresolved'],
          description: 'Filter comments by resolution status (default: all)',
          default: 'all',
        },
      },
      required: ['owner', 'repo', 'pull_number'],
    },
  },
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
      case 'get_pr_comments': {
        const { owner, repo, pull_number, per_page = 30, page = 1, resolved_status = 'all' } = args as {
          owner: string;
          repo: string;
          pull_number: number;
          per_page?: number;
          page?: number;
          resolved_status?: string;
        };

        // First, get all review comments using REST API
        // We need to get all comments to filter properly before pagination
        let allComments: any[] = [];
        let currentPage = 1;
        let hasMorePages = true;
        
        // Fetch all comments
        while (hasMorePages) {
          const pageResponse = await octokit.rest.pulls.listReviewComments({
            owner,
            repo,
            pull_number,
            per_page: 100,  // Max per page
            page: currentPage,
          });
          
          allComments = allComments.concat(pageResponse.data);
          
          // Check if there are more pages
          hasMorePages = pageResponse.headers.link?.includes('rel="next"') || false;
          currentPage++;
          
          // Safety limit to prevent infinite loops
          if (currentPage > 20) break;  // Max 2000 comments
        }

        // Get all review threads with pagination
        let allThreads: any[] = [];
        let hasNextPage = true;
        let cursor: string | null = null;

        while (hasNextPage) {
          const query = `
            query($owner: String!, $repo: String!, $prNumber: Int!, $cursor: String) {
              repository(owner: $owner, name: $repo) {
                pullRequest(number: $prNumber) {
                  reviewThreads(first: 100, after: $cursor) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    nodes {
                      id
                      isResolved
                      resolvedBy {
                        login
                      }
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

          const threadsResponse: any = await octokit.graphql(query, {
            owner,
            repo,
            prNumber: pull_number,
            cursor,
          });

          const pullRequest = threadsResponse.repository?.pullRequest;
          if (!pullRequest) break;

          const reviewThreads = pullRequest.reviewThreads;
          allThreads = allThreads.concat(reviewThreads.nodes || []);
          
          hasNextPage = reviewThreads.pageInfo.hasNextPage;
          cursor = reviewThreads.pageInfo.endCursor;
        }

        // Create a map of comment ID to thread info
        const commentThreadMap = new Map<number, { isResolved: boolean; resolvedBy: string | null }>();
        
        for (const thread of allThreads) {
          const threadInfo = {
            isResolved: thread.isResolved,
            resolvedBy: thread.resolvedBy?.login || null,
          };
          
          // Map all comments in this thread to the thread info
          const commentIds = thread.comments?.nodes?.map((c: any) => c.databaseId) || [];
          for (const commentId of commentIds) {
            commentThreadMap.set(commentId, threadInfo);
          }
        }

        // Combine comment data with thread resolution status
        const commentsWithStatus = allComments.map(comment => {
          const threadInfo = commentThreadMap.get(comment.id) || { isResolved: false, resolvedBy: null };
          
          return {
            id: comment.id,
            body: comment.body,
            user: comment.user?.login,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            html_url: comment.html_url,
            pull_request_review_id: comment.pull_request_review_id,
            path: comment.path,
            line: comment.line,
            in_reply_to_id: comment.in_reply_to_id,
            is_resolved: threadInfo.isResolved,
            resolved_by: threadInfo.resolvedBy,
          };
        });

        // Filter comments based on resolved_status
        let filteredComments = commentsWithStatus;
        if (resolved_status === 'resolved') {
          filteredComments = commentsWithStatus.filter(comment => comment.is_resolved);
        } else if (resolved_status === 'unresolved') {
          filteredComments = commentsWithStatus.filter(comment => !comment.is_resolved);
        }

        // Apply pagination to filtered results
        const startIndex = (page - 1) * per_page;
        const endIndex = startIndex + per_page;
        const paginatedComments = filteredComments.slice(startIndex, endIndex);

        // Calculate pagination info
        const totalFilteredCount = filteredComments.length;
        const totalPages = Math.ceil(totalFilteredCount / per_page);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                comments: paginatedComments,
                filter_applied: resolved_status,
                total_before_filter: allComments.length,
                total_after_filter: totalFilteredCount,
                pagination: {
                  page,
                  per_page,
                  total: totalFilteredCount,
                  total_pages: totalPages,
                  has_next_page: page < totalPages,
                  has_previous_page: page > 1,
                },
              }, null, 2),
            },
          ],
        };
      }

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