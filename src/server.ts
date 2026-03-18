#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { config } from "dotenv";
import { SlackSessionClient } from "./slack-client.js";

config();

function getEnvOrDie(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
}

const xoxcToken = getEnvOrDie("SLACK_XOXC_TOKEN");
const xoxdToken = getEnvOrDie("SLACK_XOXD_TOKEN");
const workspaceUrl = process.env.SLACK_WORKSPACE_URL;

const slack = new SlackSessionClient(xoxcToken, xoxdToken, workspaceUrl);

const TOOLS: Tool[] = [
  {
    name: "slack_test_auth",
    description:
      "Test the Slack authentication. Use this to verify that the browser session tokens are working correctly.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "slack_list_channels",
    description:
      "List Slack channels the user has access to. Returns channel names, IDs, topics, and member counts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max channels to return (default 100)",
        },
        include_private: {
          type: "boolean",
          description: "Include private channels (default true)",
        },
      },
    },
  },
  {
    name: "slack_get_channel_history",
    description:
      "Get recent messages from a Slack channel. Accepts channel ID or #channel-name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        limit: {
          type: "number",
          description: "Number of messages to retrieve (default 20)",
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "slack_get_thread",
    description:
      "Get all replies in a Slack thread. Requires channel ID and the thread's parent timestamp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        thread_ts: {
          type: "string",
          description: "Timestamp of the parent message",
        },
        limit: {
          type: "number",
          description: "Max replies to return (default 50)",
        },
      },
      required: ["channel", "thread_ts"],
    },
  },
  {
    name: "slack_post_message",
    description:
      "Post a message to a Slack channel. Optionally reply in a thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        text: {
          type: "string",
          description: "Message text (supports Slack markdown/mrkdwn)",
        },
        thread_ts: {
          type: "string",
          description: "If set, posts as a reply in this thread",
        },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "slack_search_messages",
    description:
      "Search for messages across the workspace. Uses Slack's search syntax (supports from:, in:, has:, before:, after:, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (supports Slack search modifiers)",
        },
        count: {
          type: "number",
          description: "Number of results to return (default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "slack_get_user_info",
    description:
      "Get detailed info about a Slack user by their user ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_id: {
          type: "string",
          description: "Slack user ID (U...)",
        },
      },
      required: ["user_id"],
    },
  },
  {
    name: "slack_list_users",
    description:
      "List all users in the workspace. Returns IDs, names, and bot status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max users to return (default 100)",
        },
      },
    },
  },
  {
    name: "slack_add_reaction",
    description:
      "Add an emoji reaction to a message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        timestamp: {
          type: "string",
          description: "Timestamp of the message to react to",
        },
        emoji: {
          type: "string",
          description: "Emoji name without colons (e.g. 'thumbsup')",
        },
      },
      required: ["channel", "timestamp", "emoji"],
    },
  },
  {
    name: "slack_set_channel_topic",
    description:
      "Set the topic for a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        topic: {
          type: "string",
          description: "New topic text",
        },
      },
      required: ["channel", "topic"],
    },
  },
  {
    name: "slack_upload_text_snippet",
    description:
      "Upload a text snippet or file to a channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (C...) or #channel-name",
        },
        content: {
          type: "string",
          description: "Text content of the file",
        },
        filename: {
          type: "string",
          description: "Filename (e.g. 'output.log', 'data.json')",
        },
        title: {
          type: "string",
          description: "Display title (defaults to filename)",
        },
      },
      required: ["channel", "content", "filename"],
    },
  },
  {
    name: "slack_resolve_channel",
    description:
      "Resolve a #channel-name to its channel ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Channel name (with or without #)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "slack_resolve_user",
    description:
      "Resolve a @username or display name to a user ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Username or display name (with or without @)",
        },
      },
      required: ["name"],
    },
  },
];

async function resolveChannel(channelArg: string): Promise<string> {
  if (channelArg.startsWith("C") && !channelArg.includes("#")) {
    return channelArg;
  }
  const resolved = await slack.resolveChannelByName(channelArg);
  if (!resolved) {
    throw new Error(
      `Could not find channel "${channelArg}". Try using the channel ID (starts with C) instead.`
    );
  }
  return resolved;
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "slack_test_auth": {
      const result = await slack.testAuth();
      return JSON.stringify(result, null, 2);
    }

    case "slack_list_channels": {
      const limit = (args.limit as number) ?? 100;
      const includePrivate = (args.include_private as boolean) ?? true;
      const types = includePrivate
        ? "public_channel,private_channel"
        : "public_channel";
      const channels = await slack.listChannels(limit, types);
      return JSON.stringify(channels, null, 2);
    }

    case "slack_get_channel_history": {
      const channelId = await resolveChannel(args.channel as string);
      const limit = (args.limit as number) ?? 20;
      const messages = await slack.getChannelHistory(channelId, limit);
      return JSON.stringify(messages, null, 2);
    }

    case "slack_get_thread": {
      const channelId = await resolveChannel(args.channel as string);
      const threadTs = args.thread_ts as string;
      const limit = (args.limit as number) ?? 50;
      const replies = await slack.getThreadReplies(channelId, threadTs, limit);
      return JSON.stringify(replies, null, 2);
    }

    case "slack_post_message": {
      const channelId = await resolveChannel(args.channel as string);
      const text = args.text as string;
      const threadTs = args.thread_ts as string | undefined;
      const result = await slack.postMessage(channelId, text, threadTs);
      return JSON.stringify(result, null, 2);
    }

    case "slack_search_messages": {
      const query = args.query as string;
      const count = (args.count as number) ?? 20;
      const results = await slack.searchMessages(query, count);
      return JSON.stringify(results, null, 2);
    }

    case "slack_get_user_info": {
      const userId = args.user_id as string;
      const info = await slack.getUserInfo(userId);
      return JSON.stringify(info, null, 2);
    }

    case "slack_list_users": {
      const limit = (args.limit as number) ?? 100;
      const users = await slack.listUsers(limit);
      return JSON.stringify(users, null, 2);
    }

    case "slack_add_reaction": {
      const channelId = await resolveChannel(args.channel as string);
      const timestamp = args.timestamp as string;
      const emoji = args.emoji as string;
      const result = await slack.addReaction(channelId, timestamp, emoji);
      return JSON.stringify(result, null, 2);
    }

    case "slack_set_channel_topic": {
      const channelId = await resolveChannel(args.channel as string);
      const topic = args.topic as string;
      const result = await slack.setChannelTopic(channelId, topic);
      return JSON.stringify(result, null, 2);
    }

    case "slack_upload_text_snippet": {
      const channelId = await resolveChannel(args.channel as string);
      const content = args.content as string;
      const filename = args.filename as string;
      const title = args.title as string | undefined;
      const result = await slack.uploadFile(channelId, content, filename, title);
      return JSON.stringify(result, null, 2);
    }

    case "slack_resolve_channel": {
      const name = args.name as string;
      const id = await slack.resolveChannelByName(name);
      return JSON.stringify(
        id ? { ok: true, channel_id: id } : { ok: false, error: "Channel not found" },
        null,
        2
      );
    }

    case "slack_resolve_user": {
      const name = args.name as string;
      const id = await slack.resolveUserByName(name);
      return JSON.stringify(
        id ? { ok: true, user_id: id } : { ok: false, error: "User not found" },
        null,
        2
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function main(): Promise<void> {
  const server = new Server(
    {
      name: "slack-session-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleToolCall(name, (args ?? {}) as Record<string, unknown>);
      return {
        content: [{ type: "text" as const, text: result }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Slack Session MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
