# Slack Session MCP Server

**A Slack MCP server that uses browser session tokens instead of a Slack app — the workaround for workspaces that have hit their app integration limit.**

## The Problem

Slack's free and lower-tier plans limit you to **10 app integrations**. If your workspace has maxed out that limit, you can't install another app — including the official Slack MCP server, which requires creating and installing a Slack app with OAuth scopes.

## The Workaround

This MCP server authenticates using your **browser session tokens** (`xoxc` and `xoxd`) instead of a bot token (`xoxb`). These tokens are generated automatically when you log into Slack in your browser. Since they use your existing user session:

- **No Slack app needs to be created or installed**
- **No OAuth flow or scope configuration required**
- **Does not count toward your workspace's app limit**
- **Works with any Slack plan** (Free, Pro, Business+, Enterprise Grid)
- **Operates in "stealth mode"** — nothing new appears in the workspace's app directory

The tradeoff is that actions are performed as your user account (not as a bot), and tokens need to be refreshed if your browser session expires.

## How It Works

```
┌─────────────────┐     ┌──────────────────────┐     ┌───────────┐
│  AI Host        │     │  This MCP Server      │     │  Slack    │
│  (Cursor, etc.) │────▶│  (stdio transport)    │────▶│  Web API  │
│                 │     │                        │     │           │
│                 │◀────│  xoxc + xoxd tokens   │◀────│           │
└─────────────────┘     └──────────────────────┘     └───────────┘
                              No app installed!
```

Instead of going through Slack's app directory, the server passes your browser session cookie (`xoxd`) alongside the session API token (`xoxc`) directly to Slack's Web API — the same mechanism your browser uses.

## Quick Start

### 1. Extract Your Browser Tokens

Open Slack in your web browser (not the desktop app), then:

1. Open **Developer Tools** (F12 or Cmd+Option+I)
2. Go to the **Network** tab
3. Perform any action in Slack (send a message, switch channels, etc.)
4. Find any API request to `api/` (e.g., `conversations.history`, `chat.postMessage`)
5. Extract the two tokens:

**xoxc token** — In the request **payload/body**, look for:
```
token=xoxc-XXXX-XXXX-XXXX-XXXXXXXXXXXX...
```

**xoxd token** — In the request **headers**, under `Cookie`, look for:
```
d=xoxd-XXXXXXXXXXXX...;
```

> **Tip:** You can also search the Application/Storage tab for the cookie named `d` — its value is your `xoxd` token.

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your tokens:

```env
SLACK_XOXC_TOKEN=xoxc-your-token-here
SLACK_XOXD_TOKEN=xoxd-your-token-here
SLACK_WORKSPACE_URL=https://your-workspace.slack.com
```

### 3. Verify Tokens Work

```bash
npm run verify-tokens
```

This interactive tool will test your tokens and confirm they authenticate correctly.

### 4. Build & Run

```bash
npm install
npm run build
npm start
```

### 5. Add to Cursor

Add this to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["/absolute/path/to/this/repo/dist/server.js"],
      "env": {
        "SLACK_XOXC_TOKEN": "xoxc-your-token",
        "SLACK_XOXD_TOKEN": "xoxd-your-token",
        "SLACK_WORKSPACE_URL": "https://your-workspace.slack.com"
      }
    }
  }
}
```

Or if you prefer using the `.env` file for secrets:

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["/absolute/path/to/this/repo/dist/server.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `slack_test_auth` | Verify authentication is working |
| `slack_list_channels` | List channels (public & private) |
| `slack_get_channel_history` | Get recent messages from a channel |
| `slack_get_thread` | Get all replies in a thread |
| `slack_post_message` | Send a message (optionally in a thread) |
| `slack_search_messages` | Search messages across the workspace |
| `slack_get_user_info` | Get details about a user |
| `slack_list_users` | List all workspace users |
| `slack_add_reaction` | Add an emoji reaction to a message |
| `slack_set_channel_topic` | Set a channel's topic |
| `slack_upload_text_snippet` | Upload a text file/snippet to a channel |
| `slack_resolve_channel` | Resolve `#channel-name` to a channel ID |
| `slack_resolve_user` | Resolve `@username` to a user ID |

All tools that accept a `channel` parameter will accept either a channel ID (`C0123ABCDEF`) or a `#channel-name`.

## Token Maintenance

Browser session tokens expire when:

- You log out of Slack in your browser
- Your session is revoked by a workspace admin
- The session has been idle for an extended period (varies by workspace settings)

When tokens expire, simply extract fresh ones from your browser using the same process above. There is no OAuth refresh flow to deal with — just grab the new values.

## Comparison with Other Approaches

| Approach | Requires App Install? | Counts Toward Limit? | Setup Complexity |
|----------|----------------------|---------------------|-----------------|
| **This server (xoxc/xoxd)** | No | No | Low — extract from browser |
| Official Slack MCP | Yes | Yes | Medium — OAuth + scopes |
| `@modelcontextprotocol/server-slack` | Yes | Yes | Medium — create app + bot token |
| `korotovsky/slack-mcp-server` | Optional (supports both) | Only in app mode | Medium |

## Important Caveats

1. **Actions appear as your user** — Messages posted through this MCP will show up as coming from your Slack account, not a bot.

2. **Personal permissions** — The token has access to everything your user account can access. There are no granular scope restrictions like with app tokens.

3. **Session tokens can expire** — Unlike OAuth tokens with refresh flows, browser tokens are tied to your active session. Plan to re-extract them periodically.

4. **Not officially supported** — Slack doesn't officially endorse using browser session tokens for automation. This is a workaround, not a sanctioned integration path.

5. **Best for personal/team use** — Ideal for personal productivity, team automation, and prototyping. For production integrations serving many users, consider upgrading your Slack plan to accommodate a proper app.

## Development

```bash
npm run dev        # Run in development mode (tsx, no build step)
npm run build      # Compile TypeScript
npm run typecheck  # Type-check without emitting
```

## License

ISC
