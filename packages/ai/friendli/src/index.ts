import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-friendli',
  label: 'Friendli',
  defaultModel: 'FRIENDLI_TOKEN',
  models: ['FRIENDLI_TOKEN'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('https://friendli.ai');
    if (!apiKey) throw new Error('https://friendli.ai not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-friendli · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-friendli integration not yet implemented]', model: 'FRIENDLI_TOKEN' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'https://friendli.ai',
    label: 'Friendli',
    vendorDocUrl: '',
    steps: [
      'Sign in at  and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
