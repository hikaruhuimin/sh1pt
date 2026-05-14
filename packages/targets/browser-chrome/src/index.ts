import { defineTarget, manualSetup, exec } from '@profullstack/sh1pt-core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Config {
  extensionId: string;
  sourceDir?: string;
  deployPercent?: number;
}

export default defineTarget<Config>({
  id: 'browser-chrome',
  kind: 'browser-ext',
  label: 'Chrome Web Store',
  async build(ctx, config) {
    const srcDir = config.sourceDir ?? 'dist/';
    const srcPath = join(ctx.projectDir, srcDir);
    const manifestPath = join(srcPath, 'manifest.json');
    const artifactPath = join(ctx.outDir, 'extension.zip');

    ctx.log(`verify manifest.json in ${srcDir}`);

    // Verify manifest.json exists and is valid JSON
    let manifestStr: string;
    try {
      manifestStr = await readFile(manifestPath, 'utf-8');
    } catch {
      throw new Error(
        `manifest.json not found at ${manifestPath}. Run a build step first.`,
      );
    }

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(manifestStr);
    } catch {
      throw new Error(`manifest.json at ${manifestPath} is not valid JSON`);
    }

    if (!manifest.name || !manifest.version) {
      ctx.log('manifest.json should have "name" and "version" fields', 'warn');
    }

    if (ctx.dryRun) return { artifact: artifactPath };

    ctx.log(`zip extension from ${srcDir} -> extension.zip`);
    await exec(
      'zip',
      ['-r', artifactPath, '.'],
      { cwd: srcPath, log: ctx.log, throwOnNonZero: true },
    );

    return { artifact: artifactPath };
  },
  async ship(ctx, config) {
    ctx.log(`upload + publish extension ${config.extensionId}`);
    if (ctx.dryRun) return { id: 'dry-run' };

    const extensionId =
      ctx.secret('CHROME_EXTENSION_ID') ?? config.extensionId;
    const refreshToken = ctx.secret('CHROME_REFRESH_TOKEN');
    const clientId = ctx.secret('CHROME_CLIENT_ID');
    const clientSecret = ctx.secret('CHROME_CLIENT_SECRET');

    if (!extensionId) {
      throw new Error(
        'CHROME_EXTENSION_ID not set. Run: sh1pt secret set CHROME_EXTENSION_ID <id>',
      );
    }
    if (!refreshToken) {
      throw new Error(
        'CHROME_REFRESH_TOKEN not set. Run: sh1pt secret set CHROME_REFRESH_TOKEN <token>',
      );
    }
    if (!clientId) {
      throw new Error(
        'CHROME_CLIENT_ID not set. Run: sh1pt secret set CHROME_CLIENT_ID <client-id>',
      );
    }
    if (!clientSecret) {
      throw new Error(
        'CHROME_CLIENT_SECRET not set. Run: sh1pt secret set CHROME_CLIENT_SECRET <client-secret>',
      );
    }

    // --- Exchange refresh token for access token ---
    ctx.log('obtaining access token from refresh token...');
    const tokenRes = await fetch(
      'https://www.googleapis.com/oauth2/v4/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(
        `Failed to get access token (${tokenRes.status}): ${errBody}`,
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const accessToken = tokenData.access_token;
    ctx.log('access token obtained');

    // --- Upload the extension zip ---
    const zipBuffer = await readFile(ctx.artifact);

    ctx.log(`uploading ${ctx.artifact} to Chrome Web Store...`);
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-goog-api-version': '2',
          'Content-Type': 'application/zip',
        },
        body: zipBuffer,
      },
    );

    const uploadBody = (await uploadRes.json()) as {
      uploadState?: string;
      itemError?: Array<{
        error_code?: string;
        error_detail?: string;
      }>;
    };

    if (!uploadRes.ok || uploadBody.uploadState === 'FAILURE') {
      const errors =
        uploadBody.itemError
          ?.map((e) => `${e.error_code}: ${e.error_detail}`)
          .join(', ') ?? JSON.stringify(uploadBody);
      throw new Error(`Upload failed (${uploadRes.status}): ${errors}`);
    }

    ctx.log('upload successful, publishing...');

    // --- Publish the extension ---
    const publishBodyPayload: Record<string, unknown> = {};
    if (config.deployPercent !== undefined) {
      publishBodyPayload.deployPercent = config.deployPercent;
    }
    const bodyStr =
      Object.keys(publishBodyPayload).length > 0
        ? JSON.stringify(publishBodyPayload)
        : undefined;

    const publishRes = await fetch(
      `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-goog-api-version': '2',
          'Content-Type': 'application/json',
        },
        ...(bodyStr ? { body: bodyStr } : {}),
      },
    );

    const publishBody = (await publishRes.json()) as {
      status?: Array<{ id?: string }>;
    };

    if (!publishRes.ok) {
      throw new Error(
        `Publish failed (${publishRes.status}): ${JSON.stringify(publishBody)}`,
      );
    }

    ctx.log(`published: ${JSON.stringify(publishBody)}`);

    return {
      id: `${extensionId}@${ctx.version}`,
      url: `https://chrome.google.com/webstore/detail/${extensionId}`,
    };
  },
  async status(id) {
    const [extId] = id.split('@');
    return {
      state: 'live',
      url: `https://chrome.google.com/webstore/detail/${extId}/`,
    };
  },

  setup: manualSetup({
    label: 'Chrome Web Store',
    vendorDocUrl: 'https://chrome.google.com/webstore/devconsole',
    steps: [
      'Register at chrome.google.com/webstore/devconsole ($5 one-time fee)',
      'Complete identity verification (can take 2-3 days)',
      'Generate OAuth credentials at console.cloud.google.com -> enable Chrome Web Store API',
      'Run: sh1pt secret set CHROME_CLIENT_ID <client-id>',
      'Run: sh1pt secret set CHROME_CLIENT_SECRET <client-secret>',
      'Run: sh1pt secret set CHROME_REFRESH_TOKEN <refresh-token>',
      'Run: sh1pt secret set CHROME_EXTENSION_ID <extension-id>',
    ],
  }),
});
