import { defineTarget, manualSetup, exec, ensureCli } from '@profullstack/sh1pt-core';
import { existsSync, readFileSync } from 'node:fs';
import type { ShipContext } from '@profullstack/sh1pt-core';

interface Config {
  extensionId: string;       // AMO extension id, e.g. "{some-uuid}" or "myext@example.com"
  sourceDir?: string;        // defaults to "dist/"
  channel?: 'listed' | 'unlisted';
}

// ─── JWT helper for AMO API v5 (HMAC-SHA256 via Web Crypto) ────────────────

async function createJWT(issuer: string, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: issuer,
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
  };

  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const signingInput = `${base64url(header)}.${base64url(payload)}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = Buffer.from(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput)),
  ).toString('base64url');

  return `${signingInput}.${signature}`;
}

// ─── AMO API v5 direct upload (fallback when web-ext is unavailable) ────────

async function shipViaAmoApi(
  ctx: ShipContext,
  config: Config,
  apiKey: string,
  apiSecret: string,
  channel: string,
): Promise<void> {
  ctx.log('generating JWT for AMO API v5...');
  const token = await createJWT(apiKey, apiSecret);

  const baseUrl = 'https://addons.mozilla.org/api/v5';
  const extId = encodeURIComponent(config.extensionId);
  const uploadUrl = `${baseUrl}/addons/${extId}/versions/`;

  ctx.log(`uploading ${ctx.artifact} to ${uploadUrl}`);

  const zipBuf = readFileSync(ctx.artifact);

  // Build multipart/form-data manually because FormData + fetch in Node
  // does not always set the boundary correctly in all runtimes.
  const boundary = '----sh1pt' + crypto.randomUUID().replace(/-/g, '');
  const encoder = new TextEncoder();

  const channelPart = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="channel"\r\n\r\n` +
    `${channel}\r\n`,
  );
  const uploadPart = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="upload"; filename="extension.zip"\r\n` +
    `Content-Type: application/zip\r\n\r\n`,
  );
  const trailer = encoder.encode(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([
    channelPart,
    uploadPart,
    zipBuf,
    trailer,
  ]);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      authorization: `JWT ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `AMO API v5 upload failed (${res.status}): ${errText.slice(0, 300)}`,
    );
  }

  const result = (await res.json().catch(() => ({}))) as {
    id?: number;
    url?: string;
    slug?: string;
  };
  ctx.log(
    `✓ uploaded to AMO — version id: ${result.id ?? 'unknown'}` +
      (result.url ? ` (${result.url})` : ''),
  );
}

// ─── Target definition ──────────────────────────────────────────────────────

export default defineTarget<Config>({
  id: 'browser-firefox',
  kind: 'browser-ext',
  label: 'Firefox Add-ons (AMO)',
  async build(ctx, config) {
    const src = config.sourceDir ?? 'dist/';
    const sanitizedId = config.extensionId.replace(/[{}@]/g, '_');
    const zipPath = `${ctx.outDir}/${sanitizedId}-${ctx.version}.zip`;

    ctx.log(`pack Firefox extension from ${src} for v${ctx.version}`);

    // Validate manifest.json exists
    const manifestPath = `${src}/manifest.json`;
    if (!existsSync(manifestPath)) {
      throw new Error(
        `manifest.json not found at ${manifestPath} \u2014 run a build step first`,
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    ctx.log(
      `extension: ${manifest.name ?? '(unnamed)'} v${manifest.version ?? '?'}`,
    );

    // Ensure output directory exists
    await exec('mkdir', ['-p', ctx.outDir], {
      log: ctx.log,
      throwOnNonZero: false,
    });

    // Zip the extension source directory
    // Using system zip with cwd set to source directory (same approach as
    // browser-edge adapter, but async via exec() instead of execSync)
    ctx.log('creating zip archive...');
    await exec('zip', ['-r', zipPath, '.'], { cwd: src, log: ctx.log });

    if (!existsSync(zipPath)) {
      throw new Error(
        `zip failed \u2014 expected artifact not found at ${zipPath}`,
      );
    }

    ctx.log(`created ${zipPath}`);
    return { artifact: zipPath };
  },
  async ship(ctx, config) {
    const channel = config.channel ?? 'listed';
    ctx.log(
      `sign + submit ${config.extensionId} to AMO (channel: ${channel})`,
    );

    if (ctx.dryRun) {
      return {
        id: `${config.extensionId}@${ctx.version}`,
        url: `https://addons.mozilla.org/en-US/firefox/addon/${config.extensionId}/`,
      };
    }

    // Retrieve API credentials
    const apiKey = ctx.secret('FIREFOX_API_KEY');
    const apiSecret = ctx.secret('FIREFOX_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error(
        'Missing API credentials. Set FIREFOX_API_KEY and FIREFOX_API_SECRET secrets.\n' +
          'Generate them at: https://addons.mozilla.org/en-US/developers/addon/api/key/',
      );
    }

    // Primary path: use web-ext CLI
    try {
      await ensureCli(
        'web-ext',
        'Install with: npm install -g web-ext',
        ctx.log,
      );

      const src = config.sourceDir ?? 'dist/';
      ctx.log('signing via web-ext...');

      await exec(
        'web-ext',
        [
          'sign',
          '--source-dir',
          src,
          '--api-key',
          apiKey,
          '--api-secret',
          apiSecret,
          '--channel',
          channel,
          '--id',
          config.extensionId,
          '--artifacts-dir',
          ctx.outDir,
          '--overwrite-dest',
        ],
        { cwd: ctx.projectDir, log: ctx.log },
      );

      ctx.log('signed and submitted via web-ext');
    } catch (webExtErr) {
      // Fallback: use AMO API v5 directly via fetch
      ctx.log(
        `web-ext failed (${webExtErr instanceof Error ? webExtErr.message : String(webExtErr)}), ` +
          `falling back to AMO API v5...`,
      );

      try {
        await shipViaAmoApi(ctx, config, apiKey, apiSecret, channel);
      } catch (apiErr) {
        throw new Error(
          `Both web-ext and direct AMO API failed.\n` +
            `web-ext: ${webExtErr instanceof Error ? webExtErr.message : String(webExtErr)}\n` +
            `AMO API: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`,
        );
      }
    }

    return {
      id: `${config.extensionId}@${ctx.version}`,
      url: `https://addons.mozilla.org/en-US/firefox/addon/${config.extensionId}/`,
    };
  },
  async status(id) {
    const [extId] = id.split('@');
    return {
      state: 'live',
      url: `https://addons.mozilla.org/en-US/firefox/addon/${extId}/`,
    };
  },

  setup: manualSetup({
    label: 'Firefox Add-ons (AMO)',
    vendorDocUrl:
      'https://addons.mozilla.org/en-US/developers/addon/api/key/',
    steps: [
      'Go to https://addons.mozilla.org/en-US/developers/addon/api/key/ and generate API credentials',
      'Run: sh1pt secret set FIREFOX_API_KEY <jwt-issuer>',
      'Run: sh1pt secret set FIREFOX_API_SECRET <jwt-secret>',
      'Ensure your extension has a valid manifest.json (v2 or v3)',
      'sh1pt uses web-ext or the AMO API v5 to sign and publish automatically',
    ],
  }),
});
