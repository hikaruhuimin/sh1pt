import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-gmicloud',
  label: 'GMICloud',
  defaultModel: 'GMICLOUD_API_KEY',
  models: ['GMICLOUD_API_KEY'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('https://gmicloud.ai');
    if (!apiKey) throw new Error('https://gmicloud.ai not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-gmicloud · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-gmicloud integration not yet implemented]', model: 'GMICLOUD_API_KEY' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'https://gmicloud.ai',
    label: 'GMICloud',
    vendorDocUrl: '',
    steps: [
      'Sign in at  and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
