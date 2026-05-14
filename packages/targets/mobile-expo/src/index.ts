import { defineTarget, manualSetup } from '@profullstack/sh1pt-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Config {
  appId: string;
  platform?: 'ios' | 'android' | 'all';
  profile?: string;
  submit?: boolean;
}

export default defineTarget<Config>({
  id: 'mobile-expo',
  kind: 'mobile',
  label: 'Expo / EAS',
  async build(ctx, config) {
    const platform = config.platform ?? 'all';
    const profile = config.profile ?? (ctx.channel === 'stable' ? 'production' : 'preview');

    if (ctx.dryRun) {
      const easBuildArgs = ['build', '--platform', platform, '--profile', profile];
      const plan = {
        target: 'mobile-expo',
        version: ctx.version,
        channel: ctx.channel,
        platform,
        profile,
        projectDir: ctx.projectDir,
        appId: config.appId,
        easBuildCommand: { cmd: 'eas', args: easBuildArgs },
      };
      const planPath = join(ctx.outDir, 'expo-eas-build.json');
      writeFileSync(planPath, JSON.stringify(plan, null, 2));
      ctx.log(`dry-run: wrote ${planPath}`);
      return { artifact: `${ctx.outDir}/expo-eas-build`, meta: { plan } };
    }

    ctx.log(`eas build --platform ${platform} --profile ${profile}`);
    return { artifact: `${ctx.outDir}/expo-eas-build` };
  },
  async ship(ctx, config) {
    const platform = config.platform ?? 'all';
    const profile = config.profile ?? (ctx.channel === 'stable' ? 'production' : 'preview');

    if (ctx.dryRun) {
      const shipCmd = config.submit
        ? { cmd: 'eas', args: ['submit', '--platform', platform, '--profile', profile] }
        : { cmd: 'eas', args: ['update', '--channel', ctx.channel] };
      return {
        id: 'dry-run',
        meta: { shipCommand: shipCmd },
      };
    }

    ctx.log(config.submit ? `eas submit --platform ${platform} --profile ${profile}` : `eas update --channel ${ctx.channel}`);
    return { id: `${config.appId}@${ctx.version}`, url: `https://expo.dev/accounts/${config.appId}` };
  },
  setup: manualSetup({
    label: 'Expo and EAS CLI',
    vendorDocUrl: 'https://docs.expo.dev/eas/cli/',
    steps: [
      'Install Expo CLI with mise: mise use npm:expo',
      'Install EAS CLI with mise: mise use npm:eas-cli',
      'Authenticate: eas login',
      'For CI: sh1pt secret set EXPO_TOKEN <token>',
    ],
  }),
});
