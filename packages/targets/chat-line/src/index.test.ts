import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractTestTarget, fakeShipContext } from '@profullstack/sh1pt-core/testing';
import adapter from './index.js';

contractTestTarget(adapter, {
  sampleConfig: {
    channelId: '2009963167',
    tokenKey: 'LINE_CHANNEL_ACCESS_TOKEN',
    operation: 'configure',
    webhookUrl: 'https://example.com/line-webhook',
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat-line API calls', () => {
  it('sends a push message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    const result = await adapter.ship(ctx as any, {
      operation: 'send-message',
      userId: 'U1234567890abcdef',
      message: 'Hello from sh1pt!',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/message/push');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      to: 'U1234567890abcdef',
      messages: [{ type: 'text', text: 'Hello from sh1pt!' }],
    });
    expect(result.id).toContain('push-');
  });

  it('replies to a webhook event', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    const result = await adapter.ship(ctx as any, {
      operation: 'reply',
      replyToken: 'nHuyWiB7yP5Zw52FIkc',
      message: 'Thanks for your message!',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/message/reply');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      replyToken: 'nHuyWiB7yP5Zw52FIkc',
      messages: [{ type: 'text', text: 'Thanks for your message!' }],
    });
  });

  it('fetches a user profile', async () => {
    const mockProfile = {
      userId: 'U1234567890abcdef',
      displayName: 'Test User',
      pictureUrl: 'https://example.com/pic.jpg',
      statusMessage: 'Hello!',
      language: 'ja',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    const result = await adapter.ship(ctx as any, {
      operation: 'get-profile',
      userId: 'U1234567890abcdef',
    });

    expect(result.meta?.displayName).toBe('Test User');
    expect(result.meta?.language).toBe('ja');
    expect(result.meta?.pictureUrl).toBe('https://example.com/pic.jpg');
  });

  it('broadcasts a message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    const result = await adapter.ship(ctx as any, {
      operation: 'broadcast',
      message: 'Announcement to all followers!',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      messages: [{ type: 'text', text: 'Announcement to all followers!' }],
    });
  });

  it('configures the webhook endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ endpoint: 'https://example.com/line-webhook', active: true }),
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    const result = await adapter.ship(ctx as any, {
      operation: 'configure',
      webhookUrl: 'https://example.com/line-webhook',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/channel/webhook/endpoint');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      endpoint: 'https://example.com/line-webhook',
    });
  });

  it('requires LINE_CHANNEL_ACCESS_TOKEN outside dry-run', async () => {
    const ctx = fakeShipContext({ dryRun: false });
    await expect(adapter.ship(ctx as any, {
      operation: 'send-message',
      userId: 'U123',
      message: 'test',
    })).rejects.toThrow('LINE_CHANNEL_ACCESS_TOKEN not in vault');
  });

  it('surfaces LINE API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Authentication failed. Check your access token.' }),
    } as any);

    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'invalid-token' : undefined,
    });

    await expect(adapter.ship(ctx as any, {
      operation: 'send-message',
      userId: 'U123',
      message: 'test',
    })).rejects.toThrow('Authentication failed');
  });

  it('validates required fields', async () => {
    const ctx = fakeShipContext({
      dryRun: false,
      secret: (key: string) => key === 'LINE_CHANNEL_ACCESS_TOKEN' ? 'test-token' : undefined,
    });

    // Missing userId for send-message
    await expect(adapter.ship(ctx as any, {
      operation: 'send-message',
      message: 'test',
    })).rejects.toThrow('userId is required');

    // Missing message for send-message
    await expect(adapter.ship(ctx as any, {
      operation: 'send-message',
      userId: 'U123',
    })).rejects.toThrow('message is required');

    // Missing replyToken for reply
    await expect(adapter.ship(ctx as any, {
      operation: 'reply',
      message: 'test',
    })).rejects.toThrow('replyToken is required');

    // Missing userId for get-profile
    await expect(adapter.ship(ctx as any, {
      operation: 'get-profile',
    })).rejects.toThrow('userId is required');

    // Missing message for broadcast
    await expect(adapter.ship(ctx as any, {
      operation: 'broadcast',
    })).rejects.toThrow('message is required');
  });
});
