import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-mistral',
  label: 'Mistral',
  defaultModel: 'mistral-large-latest',
  models: ['mistral-large-latest'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('MISTRAL_API_KEY');
    if (!apiKey) throw new Error('MISTRAL_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-mistral · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-mistral integration not yet implemented]', model: 'mistral-large-latest' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'MISTRAL_API_KEY',
    label: 'Mistral',
    vendorDocUrl: 'https://console.mistral.ai',
    steps: [
      'Sign in at https://console.mistral.ai and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
