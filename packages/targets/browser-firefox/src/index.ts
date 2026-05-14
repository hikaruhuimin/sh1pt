import { defineTarget, manualSetup, exec } from '@profullstack/sh1pt-core';
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

interface Config {
  extensionId: string;       // AMO extension id, e.g. "{some-uuid}" or "myext@example.com"
  sourceDir?: string;        // defaults to "dist/" or "web-ext-artifacts/"
  channel?: 'listed' | 'unlisted';
}

export default defineTarget<Config>({
  id: 'browser-firefox',
  kind: 'browser-ext',
  label: 'Firefox Add-ons (AMO)',
  async build(ctx, config) {
    const src = resolve(ctx.projectDir, config.sourceDir ?? 'dist/');
    const channel = config.channel ?? 'listed';
    const safeName = config.extensionId.replace(/[{}@]/g, '_');
    const zipPath = `${ctx.outDir}/${safeName}-${ctx.version}.zip`;

    if (ctx.dryRun) {
      const webExtArgs = ['build', '--source-dir', src, '--artifacts-dir', ctx.outDir];
      const plan = {
        target: 'browser-firefox',
        version: ctx.version,
        channel: ctx.channel,
        sourceDir: src,
        expectedArtifact: zipPath,
        extensionId: config.extensionId,
        amoChannel: channel,
        webExtBuildCommand: { cmd: 'web-ext', args: webExtArgs },
      };
      const planPath = join(ctx.outDir, 'firefox-package-plan.json');
      writeFileSync(planPath, JSON.stringify(plan, null, 2));
      ctx.log(`dry-run: wrote ${planPath}`);
      return { artifact: zipPath, meta: { plan } };
    }

    ctx.log(`pack Firefox extension from ${src} using web-ext build`);
    // Run `web-ext build --source-dir ${src} --artifacts-dir ${ctx.outDir}`
    // Validates manifest.json (v2 or v3) and zips into ctx.outDir
    await exec('web-ext', ['build', '--source-dir', src, '--artifacts-dir', ctx.outDir], {
      log: ctx.log,
      throwOnNonZero: true,
    });

    return { artifact: zipPath };
  },
  async ship(ctx, config) {
    const channel = config.channel ?? 'listed';
    ctx.log(`sign + submit ${config.extensionId} to AMO (channel: ${channel})`);
    if (ctx.dryRun) {
      const src = resolve(ctx.projectDir, config.sourceDir ?? 'dist/');
      const shipPlan = {
        extensionId: config.extensionId,
        channel,
        webExtSignCommand: {
          cmd: 'web-ext',
          args: ['sign', '--api-key=<AMO_JWT_ISSUER>', '--api-secret=<AMO_JWT_SECRET>',
                 `--channel=${channel}`, `--source-dir=${src}`],
        },
      };
      return { id: 'dry-run', meta: { shipPlan } };
    }

    const amoJwtIssuer = ctx.secret('AMO_JWT_ISSUER');
    const amoJwtSecret = ctx.secret('AMO_JWT_SECRET');

    if (!amoJwtIssuer || !amoJwtSecret) {
      throw new Error('Missing secrets: AMO_JWT_ISSUER, AMO_JWT_SECRET — run: sh1pt secret set AMO_JWT_ISSUER <jwt-issuer>');
    }

    // Sign and submit via web-ext sign
    await exec('web-ext', [
      'sign',
      '--api-key', amoJwtIssuer,
      '--api-secret', amoJwtSecret,
      '--channel', channel,
      '--source-dir', resolve(ctx.projectDir, config.sourceDir ?? 'dist/'),
    ], { log: ctx.log, throwOnNonZero: true });

    return {
      id: `${config.extensionId}@${ctx.version}`,
      url: `https://addons.mozilla.org/en-US/firefox/addon/${config.extensionId}/`,
    };
  },
  async status(id) {
    const [extId] = id.split('@');
    return { state: 'live', url: `https://addons.mozilla.org/en-US/firefox/addon/${extId}/` };
  },

  setup: manualSetup({
    label: 'Firefox Add-ons (AMO)',
    vendorDocUrl: 'https://addons.mozilla.org/en-US/developers/addon/api/key/',
    steps: [
      'Go to https://addons.mozilla.org/en-US/developers/addon/api/key/ and generate API credentials',
      'Run: sh1pt secret set AMO_JWT_ISSUER <jwt-issuer>',
      'Run: sh1pt secret set AMO_JWT_SECRET <jwt-secret>',
      'Ensure your extension has a valid manifest.json (v2 or v3)',
      'sh1pt uses web-ext to build, sign, and publish automatically',
    ],
  }),
});
