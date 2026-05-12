import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-cerebras',
  label: 'Cerebras',
  defaultModel: 'llama-3.3-70b',
  models: ['llama-3.3-70b'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('CEREBRAS_API_KEY');
    if (!apiKey) throw new Error('CEREBRAS_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-cerebras · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-cerebras integration not yet implemented]', model: 'llama-3.3-70b' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'CEREBRAS_API_KEY',
    label: 'Cerebras',
    vendorDocUrl: 'https://cloud.cerebras.ai',
    steps: [
      'Sign in at https://cloud.cerebras.ai and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
