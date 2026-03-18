#!/usr/bin/env node

/**
 * Interactive helper to verify extracted Slack browser session tokens.
 *
 * Usage:
 *   npx ts-node src/extract-tokens.ts
 *   -- or after building --
 *   node dist/extract-tokens.js
 *
 * You'll need to manually extract xoxc and xoxd tokens from your browser
 * (see README for step-by-step instructions), then paste them here to verify
 * they work.
 */

import * as readline from "readline";
import { SlackSessionClient } from "./slack-client.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Slack Browser Token Verification");
  console.log("  (No Slack app installation required!)");
  console.log("=".repeat(60));
  console.log();
  console.log("This tool verifies your browser session tokens work correctly.");
  console.log("See the README for instructions on how to extract them.");
  console.log();

  const xoxc = await ask("Paste your xoxc token: ");
  if (!xoxc.startsWith("xoxc-")) {
    console.error("Warning: Token doesn't start with 'xoxc-'. It may not work.");
  }

  const xoxd = await ask("Paste your xoxd token: ");
  if (!xoxd.startsWith("xoxd-")) {
    console.error("Warning: Token doesn't start with 'xoxd-'. It may not work.");
  }

  const workspaceUrl = await ask(
    "Workspace URL (e.g. https://mycompany.slack.com) [press Enter to skip]: "
  );

  console.log("\nTesting authentication...");

  const client = new SlackSessionClient(
    xoxc.trim(),
    xoxd.trim(),
    workspaceUrl.trim() || undefined
  );

  const result = await client.testAuth();

  if (result.ok) {
    console.log("\n  Authentication successful!");
    console.log(`  User: ${result.user}`);
    console.log(`  Team: ${result.team}`);
    console.log();
    console.log("Add these to your .env file:");
    console.log();
    console.log(`SLACK_XOXC_TOKEN=${xoxc.trim()}`);
    console.log(`SLACK_XOXD_TOKEN=${xoxd.trim()}`);
    if (workspaceUrl.trim()) {
      console.log(`SLACK_WORKSPACE_URL=${workspaceUrl.trim()}`);
    }
    console.log();

    const tryChannels = await ask("List your channels to confirm? (y/N): ");
    if (tryChannels.toLowerCase() === "y") {
      console.log("\nFetching channels...\n");
      const channels = await client.listChannels(10);
      for (const ch of channels) {
        const prefix = ch.is_private ? "🔒" : "#";
        console.log(`  ${prefix} ${ch.name} (${ch.id}) - ${ch.num_members} members`);
      }
      console.log(`\n  (showing first 10 of your accessible channels)`);
    }
  } else {
    console.error(`\n  Authentication failed: ${result.error}`);
    console.error("  Please double-check your tokens and try again.");
  }

  rl.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
