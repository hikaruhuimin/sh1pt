import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-nebius',
  label: 'Nebius Token Factory',
  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
  models: ['meta-llama/Llama-3.3-70B-Instruct'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('NEBIUS_API_KEY');
    if (!apiKey) throw new Error('NEBIUS_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-nebius · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-nebius integration not yet implemented]', model: 'meta-llama/Llama-3.3-70B-Instruct' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'NEBIUS_API_KEY',
    label: 'Nebius Token Factory',
    vendorDocUrl: 'https://studio.nebius.ai',
    steps: [
      'Sign in at https://studio.nebius.ai and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
