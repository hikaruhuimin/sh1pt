import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-perplexity',
  label: 'Perplexity',
  defaultModel: 'llama-3.1-sonar-large-128k-online',
  models: ['llama-3.1-sonar-large-128k-online'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-perplexity · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-perplexity integration not yet implemented]', model: 'llama-3.1-sonar-large-128k-online' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'PERPLEXITY_API_KEY',
    label: 'Perplexity',
    vendorDocUrl: 'https://www.perplexity.ai/settings/api',
    steps: [
      'Sign in at https://www.perplexity.ai/settings/api and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
