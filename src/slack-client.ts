import { WebClient, type WebAPICallResult } from "@slack/web-api";

/**
 * Slack client that authenticates using browser session tokens (xoxc + xoxd),
 * bypassing the need to install a Slack app in the workspace. This is the key
 * workaround for workspaces that have hit their app integration limit.
 *
 * xoxc tokens are user-session tokens extracted from the browser. They require
 * a companion xoxd cookie to authenticate. Together, they give the same API
 * access as the logged-in user — no app, no OAuth, no scopes to configure.
 */
export class SlackSessionClient {
  private client: WebClient;

  constructor(xoxcToken: string, xoxdCookie: string, workspaceUrl?: string) {
    const headers: Record<string, string> = {
      Cookie: `d=${xoxdCookie}`,
    };

    this.client = new WebClient(xoxcToken, {
      headers,
      ...(workspaceUrl ? { slackApiUrl: `${workspaceUrl.replace(/\/$/, "")}/api/` } : {}),
    });
  }

  async testAuth(): Promise<{ ok: boolean; user?: string; team?: string; error?: string }> {
    try {
      const result = await this.client.auth.test();
      return {
        ok: true,
        user: result.user as string,
        team: result.team as string,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async listChannels(
    limit = 100,
    types = "public_channel,private_channel"
  ): Promise<Array<{ id: string; name: string; is_private: boolean; topic: string; num_members: number }>> {
    const result = await this.client.conversations.list({
      limit,
      types,
      exclude_archived: true,
    });

    return (
      (result.channels as Array<Record<string, unknown>>)?.map((ch) => ({
        id: ch.id as string,
        name: ch.name as string,
        is_private: (ch.is_private as boolean) ?? false,
        topic: ((ch.topic as Record<string, unknown>)?.value as string) ?? "",
        num_members: (ch.num_members as number) ?? 0,
      })) ?? []
    );
  }

  async getChannelHistory(
    channelId: string,
    limit = 20
  ): Promise<Array<{ user: string; text: string; ts: string; thread_ts?: string }>> {
    const result = await this.client.conversations.history({
      channel: channelId,
      limit,
    });

    return (
      (result.messages as Array<Record<string, unknown>>)?.map((msg) => ({
        user: (msg.user as string) ?? "unknown",
        text: (msg.text as string) ?? "",
        ts: msg.ts as string,
        thread_ts: msg.thread_ts as string | undefined,
      })) ?? []
    );
  }

  async getThreadReplies(
    channelId: string,
    threadTs: string,
    limit = 50
  ): Promise<Array<{ user: string; text: string; ts: string }>> {
    const result = await this.client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit,
    });

    return (
      (result.messages as Array<Record<string, unknown>>)?.map((msg) => ({
        user: (msg.user as string) ?? "unknown",
        text: (msg.text as string) ?? "",
        ts: msg.ts as string,
      })) ?? []
    );
  }

  async postMessage(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<{ ok: boolean; ts?: string; error?: string }> {
    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });
      return { ok: true, ts: result.ts as string };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async searchMessages(
    query: string,
    count = 20
  ): Promise<Array<{ channel: string; text: string; user: string; ts: string; permalink: string }>> {
    const result = await this.client.search.messages({
      query,
      count,
      sort: "timestamp",
      sort_dir: "desc",
    });

    const matches =
      (result.messages as Record<string, unknown>)?.matches as Array<Record<string, unknown>> | undefined;

    return (
      matches?.map((m) => ({
        channel: ((m.channel as Record<string, unknown>)?.name as string) ?? "unknown",
        text: (m.text as string) ?? "",
        user: (m.user as string) ?? (m.username as string) ?? "unknown",
        ts: m.ts as string,
        permalink: (m.permalink as string) ?? "",
      })) ?? []
    );
  }

  async getUserInfo(userId: string): Promise<{
    id: string;
    name: string;
    real_name: string;
    display_name: string;
    email?: string;
    is_bot: boolean;
  }> {
    const result = await this.client.users.info({ user: userId });
    const user = result.user as Record<string, unknown>;
    const profile = user.profile as Record<string, unknown>;

    return {
      id: user.id as string,
      name: user.name as string,
      real_name: (user.real_name as string) ?? "",
      display_name: (profile?.display_name as string) ?? "",
      email: profile?.email as string | undefined,
      is_bot: (user.is_bot as boolean) ?? false,
    };
  }

  async listUsers(limit = 100): Promise<
    Array<{
      id: string;
      name: string;
      real_name: string;
      is_bot: boolean;
    }>
  > {
    const result = await this.client.users.list({ limit });
    const members = result.members as Array<Record<string, unknown>> | undefined;

    return (
      members
        ?.filter((u) => !(u.deleted as boolean))
        .map((u) => ({
          id: u.id as string,
          name: u.name as string,
          real_name: (u.real_name as string) ?? "",
          is_bot: (u.is_bot as boolean) ?? false,
        })) ?? []
    );
  }

  async addReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.reactions.add({
        channel: channelId,
        timestamp,
        name: emoji.replace(/:/g, ""),
      });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async setChannelTopic(
    channelId: string,
    topic: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.conversations.setTopic({
        channel: channelId,
        topic,
      });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async uploadFile(
    channelId: string,
    content: string,
    filename: string,
    title?: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.filesUploadV2({
        channel_id: channelId,
        content,
        filename,
        title: title ?? filename,
      });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async resolveChannelByName(name: string): Promise<string | null> {
    const cleanName = name.replace(/^#/, "");
    const channels = await this.listChannels(200);
    const match = channels.find(
      (ch) => ch.name.toLowerCase() === cleanName.toLowerCase()
    );
    return match?.id ?? null;
  }

  async resolveUserByName(name: string): Promise<string | null> {
    const cleanName = name.replace(/^@/, "");
    const users = await this.listUsers(200);
    const match = users.find(
      (u) =>
        u.name.toLowerCase() === cleanName.toLowerCase() ||
        u.real_name.toLowerCase() === cleanName.toLowerCase()
    );
    return match?.id ?? null;
  }
}
