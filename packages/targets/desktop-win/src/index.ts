import { defineTarget, manualSetup } from '@profullstack/sh1pt-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Config {
  appId: string;             // Partner Center app identity (e.g. Acme.MyApp)
  publisherId: string;       // e.g. "CN=12345678-90ab-cdef-..."
  // 'msstore' = Microsoft Store (MSIX), 'msi' = direct MSI distribution, 'both'
  distribution: 'msstore' | 'msi' | 'both';
  signingCertThumbprint?: string;
  architectures?: ('x64' | 'arm64' | 'x86')[];
}

export default defineTarget<Config>({
  id: 'desktop-win',
  kind: 'desktop',
  label: 'Windows (Microsoft Store / MSIX / MSI)',
  async build(ctx, config) {
    const arches = config.architectures ?? ['x64', 'arm64'];

    if (ctx.dryRun) {
      const plan: Record<string, unknown> = {
        target: 'desktop-win',
        version: ctx.version,
        channel: ctx.channel,
        appId: config.appId,
        publisherId: config.publisherId,
        distribution: config.distribution,
        architectures: arches,
      };

      const msixPath = `${ctx.outDir}/app.msixbundle`;
      const msiPath = `${ctx.outDir}/app.msi`;

      if (config.distribution === 'msstore' || config.distribution === 'both') {
        plan.msixArtifact = msixPath;
        plan.makeappxCommand = { cmd: 'makeappx', args: ['pack', '/d', ctx.projectDir, '/p', msixPath] };
        plan.signtoolCommand = { cmd: 'signtool', args: ['sign', '/fd', 'SHA256', '/sha1', config.signingCertThumbprint ?? '<MISSING>', msixPath] };
      }
      if (config.distribution === 'msi' || config.distribution === 'both') {
        plan.msiArtifact = msiPath;
        plan.wixCommand = { cmd: 'candle', args: ['-out', `${ctx.outDir}/`, `${ctx.projectDir}/*.wxs`] };
        plan.msiSigntoolCommand = { cmd: 'signtool', args: ['sign', '/fd', 'SHA256', '/sha1', config.signingCertThumbprint ?? '<MISSING>', msiPath] };
      }

      if (!config.signingCertThumbprint) {
        plan.followUp = 'signingCertThumbprint not configured — set it to enable code signing';
      }

      const planPath = join(ctx.outDir, 'windows-package-plan.json');
      writeFileSync(planPath, JSON.stringify(plan, null, 2));
      ctx.log(`dry-run: wrote ${planPath}`);
      const ext = config.distribution === 'msi' ? 'msi' : 'msixbundle';
      return { artifact: `${ctx.outDir}/app.${ext}`, meta: { plan } };
    }

    ctx.log(`build ${config.distribution} · arches=${arches.join(',')}`);
    // MSIX: makeappx pack + signtool sign using signingCertThumbprint
    // MSI: WiX toolset → .msi → signtool sign
    // Requires Windows runner; cloud builds route to a windows worker.
    const ext = config.distribution === 'msi' ? 'msi' : 'msixbundle';
    return { artifact: `${ctx.outDir}/app.${ext}` };
  },
  async ship(ctx, config) {
    ctx.log(`publish ${config.appId}@${ctx.version} · distribution=${config.distribution}`);
    if (ctx.dryRun) return { id: 'dry-run' };
    // TODO:
    //  - msstore: Partner Center submission API (create submission → upload → commit)
    //  - msi: upload to configured CDN/GitHub release + update winget manifest via pkg-winget
    return {
      id: `${config.appId}@${ctx.version}`,
      url: config.distribution !== 'msi' ? `https://apps.microsoft.com/detail/${config.appId}` : undefined,
    };
  },
  async status(id) {
    return { state: 'in-review', version: id };
  },

  setup: manualSetup({
    label: "Microsoft Store (Windows)",
    vendorDocUrl: "https://partner.microsoft.com/dashboard",
    steps: [
      "Register at partner.microsoft.com ($19 individual / $99 company)",
      "Complete identity verification (1-3 days)",
      "Create an Azure AD app → generate client_secret",
      "Run: sh1pt secret set MS_STORE_TENANT_ID <uuid>",
      "Run: sh1pt secret set MS_STORE_CLIENT_ID <uuid>",
      "Run: sh1pt secret set MS_STORE_CLIENT_SECRET <secret>",
    ],
  }),
});
