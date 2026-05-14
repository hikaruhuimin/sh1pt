import { defineTarget, manualSetup, exec } from '@profullstack/sh1pt-core';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

interface Config {
  productId: string;         // Edge Partner Center product ID
  sourceDir?: string;        // defaults to "dist/"
  notes?: string;            // release notes for reviewer
}

export default defineTarget<Config>({
  id: 'browser-edge',
  kind: 'browser-ext',
  label: 'Microsoft Edge Add-ons',
  async build(ctx, config) {
    const src = resolve(ctx.projectDir, config.sourceDir ?? 'dist/');
    const zipPath = `${ctx.outDir}/${config.productId}-${ctx.version}.zip`;

    if (ctx.dryRun) {
      const plan = {
        target: 'browser-edge',
        version: ctx.version,
        channel: ctx.channel,
        sourceDir: src,
        expectedArtifact: zipPath,
        productId: config.productId,
        zipCommand: ['zip', '-r', zipPath, '.'],
      };
      const planPath = join(ctx.outDir, 'edge-package-plan.json');
      writeFileSync(planPath, JSON.stringify(plan, null, 2));
      ctx.log(`dry-run: wrote ${planPath}`);
      return { artifact: zipPath, meta: { plan } };
    }

    ctx.log(`pack Edge extension from ${src} for v${ctx.version}`);

    // Validate manifest.json exists and is manifest_version 3
    const manifestPath = join(src, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`manifest.json not found at ${manifestPath} — run a build step first`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (manifest.manifest_version !== 3) {
      ctx.log(`manifest_version is ${manifest.manifest_version}, Edge requires v3`, 'warn');
    }

    // Zip the extension directory using shared exec helper
    await exec('mkdir', ['-p', ctx.outDir], { log: ctx.log, throwOnNonZero: true });
    await exec('zip', ['-r', zipPath, '.'], { cwd: src, log: ctx.log, throwOnNonZero: true });

    ctx.log(`created ${zipPath}`);
    return { artifact: zipPath };
  },
  async ship(ctx, config) {
    ctx.log(`upload ${config.productId} to Edge Partner Center (v${ctx.version})`);
    if (ctx.dryRun) {
      return { id: `${config.productId}@${ctx.version}`, url: `https://microsoftedge.microsoft.com/addons/detail/${config.productId}` };
    }

    // Fetch secrets for Edge Publish API OAuth
    const clientId = ctx.secret('EDGE_CLIENT_ID');
    const clientSecret = ctx.secret('EDGE_CLIENT_SECRET');
    const tokenUrl = ctx.secret('EDGE_ACCESS_TOKEN_URL');

    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('Missing secrets: EDGE_CLIENT_ID, EDGE_CLIENT_SECRET, EDGE_ACCESS_TOKEN_URL — run: sh1pt secret set EDGE_CLIENT_ID <client-id>');
    }

    // Step 1: Get OAuth access token
    ctx.log('acquiring OAuth token...');
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.addons.microsoftedge.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      throw new Error(`OAuth token request failed (${tokenRes.status}): ${errText.slice(0, 200)}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const accessToken = tokenData.access_token;
    ctx.log('✓ OAuth token acquired');

    // Step 2: Upload the package (zip) as a draft submission
    ctx.log('uploading package...');
    const uploadUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${config.productId}/submissions/draft/package`;
    const zipBuf = readFileSync(ctx.artifact);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/zip',
        'content-length': String(zipBuf.length),
      },
      body: zipBuf,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      throw new Error(`Package upload failed (${uploadRes.status}): ${errText.slice(0, 200)}`);
    }

    ctx.log('✓ package uploaded as draft');

    // Step 3: Submit the draft for review
    ctx.log('submitting for review...');
    const submitUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${config.productId}/submissions`;
    const notes = config.notes;
    const submitBody: Record<string, unknown> = {};
    if (notes) { submitBody.notes = notes; }

    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(submitBody),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => '');
      throw new Error(`Submission failed (${submitRes.status}): ${errText.slice(0, 200)}`);
    }

    const submitData = (await submitRes.json()) as { id?: string };
    ctx.log('✓ submitted to Edge Partner Center');

    return {
      id: `${config.productId}@${ctx.version}`,
      url: `https://microsoftedge.microsoft.com/addons/detail/${config.productId}`,
      meta: { submissionId: submitData.id },
    };
  },
  async status(id) {
    const [productId] = id.split('@');
    return { state: 'live', url: `https://microsoftedge.microsoft.com/addons/detail/${productId}` };
  },
  setup: manualSetup({
    label: 'Microsoft Edge Add-ons',
    vendorDocUrl: 'https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api',
    steps: [
      'Go to https://partner.microsoft.com/dashboard/ and register your extension',
      'Create an API credential under Account → API credentials',
      'Run: sh1pt secret set EDGE_CLIENT_ID <client-id>',
      'Run: sh1pt secret set EDGE_CLIENT_SECRET <client-secret>',
      'Run: sh1pt secret set EDGE_ACCESS_TOKEN_URL <token-url>',
      'sh1pt uses the Edge Add-ons Publish API to upload and submit automatically',
    ],
  }),
});
