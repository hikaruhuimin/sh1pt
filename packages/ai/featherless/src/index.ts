import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-featherless',
  label: 'Featherless',
  defaultModel: 'FEATHERLESS_API_KEY',
  models: ['FEATHERLESS_API_KEY'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('https://featherless.ai');
    if (!apiKey) throw new Error('https://featherless.ai not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-featherless · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-featherless integration not yet implemented]', model: 'FEATHERLESS_API_KEY' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'https://featherless.ai',
    label: 'Featherless',
    vendorDocUrl: '',
    steps: [
      'Sign in at  and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
