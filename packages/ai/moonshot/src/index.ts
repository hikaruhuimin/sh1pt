import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-moonshot',
  label: 'Moonshot AI',
  defaultModel: 'moonshot-v1-8k',
  models: ['moonshot-v1-8k'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('MOONSHOT_API_KEY');
    if (!apiKey) throw new Error('MOONSHOT_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-moonshot · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-moonshot integration not yet implemented]', model: 'moonshot-v1-8k' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'MOONSHOT_API_KEY',
    label: 'Moonshot AI',
    vendorDocUrl: 'https://platform.moonshot.cn',
    steps: [
      'Sign in at https://platform.moonshot.cn and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
