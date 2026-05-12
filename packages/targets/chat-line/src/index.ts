import { defineTarget, manualSetup } from '@profullstack/sh1pt-core';

// LINE Messaging API — send messages, reply to webhook events, get user profiles,
// and broadcast to all followers.
// Requires a LINE channel access token (long-lived or short-lived) from the
// LINE Developers Console (developers.line.biz).
//
// Hosting the webhook endpoint itself is orthogonal — pair with deploy-workers,
// deploy-fly, or deploy-vercel.

interface Config {
  /** The LINE channel ID (from Developers Console) */
  channelId?: string;
  /** Key for the channel access token in the vault (defaults to LINE_CHANNEL_ACCESS_TOKEN) */
  tokenKey?: string;
  /** Webhook URL where LINE will POST events */
  webhookUrl?: string;
  /** User ID to send a message to (for send-message operation) */
  userId?: string;
  /** Reply token from a webhook event (for reply operation) */
  replyToken?: string;
  /** Message text content */
  message?: string;
  /** Operation to perform: send-message, reply, get-profile, or broadcast */
  operation?: 'send-message' | 'reply' | 'get-profile' | 'broadcast';
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

interface LineApiError {
  message: string;
  details?: { message: string; property: string }[];
}

export default defineTarget<Config>({
  id: 'chat-line',
  kind: 'chat',
  label: 'LINE Messaging API',

  async build(ctx, config) {
    ctx.log(`chat-line · prepare manifest for channel ${config.channelId ?? '(channel ID pending)'}`);
    return { artifact: `${ctx.outDir}/line-config.json` };
  },

  async ship(ctx, config) {
    ctx.log(`chat-line · ${config.operation ?? 'configure'} operation`);
    if (ctx.dryRun) return { id: 'dry-run', meta: { operation: config.operation } };

    const tokenKey = config.tokenKey ?? 'LINE_CHANNEL_ACCESS_TOKEN';
    const token = ctx.secret(tokenKey);
    if (!token) {
      throw new Error(`${tokenKey} not in vault — run: sh1pt secret set ${tokenKey} <access-token>`);
    }

    const operation = config.operation ?? 'configure';
    const baseUrl = 'https://api.line.me/v2/bot';

    switch (operation) {
      case 'send-message': {
        if (!config.userId) throw new Error('userId is required for send-message operation');
        if (!config.message) throw new Error('message is required for send-message operation');

        ctx.log(`chat-line · sending message to user ${config.userId}`);
        await callLineApi(token, `${baseUrl}/message/push`, {
          to: config.userId,
          messages: [{ type: 'text', text: config.message }],
        });
        return { id: `push-${config.userId}`, meta: { operation: 'send-message', userId: config.userId } };
      }

      case 'reply': {
        if (!config.replyToken) throw new Error('replyToken is required for reply operation');
        if (!config.message) throw new Error('message is required for reply operation');

        ctx.log(`chat-line · replying to event ${config.replyToken}`);
        await callLineApi(token, `${baseUrl}/message/reply`, {
          replyToken: config.replyToken,
          messages: [{ type: 'text', text: config.message }],
        });
        return { id: `reply-${config.replyToken}`, meta: { operation: 'reply' } };
      }

      case 'get-profile': {
        if (!config.userId) throw new Error('userId is required for get-profile operation');

        ctx.log(`chat-line · fetching profile for user ${config.userId}`);
        const profile = await callLineApi<LineProfile>(token, `${baseUrl}/profile/${config.userId}`);
        return {
          id: `profile-${config.userId}`,
          meta: {
            operation: 'get-profile',
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
            language: profile.language,
          },
        };
      }

      case 'broadcast': {
        if (!config.message) throw new Error('message is required for broadcast operation');

        ctx.log(`chat-line · broadcasting message to all followers`);
        await callLineApi(token, `${baseUrl}/message/broadcast`, {
          messages: [{ type: 'text', text: config.message }],
        });
        return { id: `broadcast-${Date.now()}`, meta: { operation: 'broadcast' } };
      }

      case 'configure':
      default: {
        // Configure webhook URL
        if (config.webhookUrl) {
          ctx.log(`chat-line · setting webhook URL: ${config.webhookUrl}`);
          await callLineApi(token, `${baseUrl}/channel/webhook/endpoint`, {
            endpoint: config.webhookUrl,
          });
        }

        // Verify webhook is set
        const webhookConfig = await callLineApi<{ endpoint: string; active: boolean }>(
          token, `${baseUrl}/channel/webhook/endpoint`
        );
        ctx.log(`chat-line · webhook endpoint: ${webhookConfig.endpoint} (active: ${webhookConfig.active})`);

        return {
          id: `line-channel-${config.channelId ?? 'configured'}`,
          meta: { operation: 'configure', webhookEndpoint: webhookConfig.endpoint },
        };
      }
    }
  },

  async status(id) {
    return { state: 'live', version: id };
  },

  setup: manualSetup({
    label: 'LINE Messaging API',
    vendorDocUrl: 'https://developers.line.biz/console/',
    steps: [
      'Visit https://developers.line.biz/console/ → Create a provider (or use existing)',
      'Create a Messaging API channel → note the Channel ID and Channel Secret',
      'In the Messaging API tab, issue a long-lived channel access token',
      'Set the webhook URL to your sh1pt-hosted endpoint',
      'Run: sh1pt secret set LINE_CHANNEL_ACCESS_TOKEN <token>',
      'Disable "Auto-reply messages" in LINE Official Account Manager to avoid conflicts',
    ],
  }),
});

async function callLineApi<T>(
  token: string,
  url: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let errorMessage: string;
    try {
      const error = await res.json() as LineApiError;
      errorMessage = error.message ?? JSON.stringify(error);
      if (error.details?.length) {
        errorMessage += ` — ${error.details.map(d => `${d.property}: ${d.message}`).join(', ')}`;
      }
    } catch {
      errorMessage = `LINE API error (${res.status})`;
    }
    throw new Error(errorMessage);
  }

  // GET requests return JSON body; POST/PUT return empty body on success
  if (body) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}
