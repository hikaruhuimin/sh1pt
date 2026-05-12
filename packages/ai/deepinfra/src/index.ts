import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-deepinfra',
  label: 'DeepInfra',
  defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  models: ['meta-llama/Meta-Llama-3.1-70B-Instruct'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('DEEPINFRA_API_KEY');
    if (!apiKey) throw new Error('DEEPINFRA_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-deepinfra · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-deepinfra integration not yet implemented]', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'DEEPINFRA_API_KEY',
    label: 'DeepInfra',
    vendorDocUrl: 'https://deepinfra.com',
    steps: [
      'Sign in at https://deepinfra.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
