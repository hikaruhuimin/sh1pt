import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-azure',
  label: 'Azure OpenAI',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('AZURE_OPENAI_API_KEY');
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-azure · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-azure integration not yet implemented]', model: 'gpt-4o' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'AZURE_OPENAI_API_KEY',
    label: 'Azure OpenAI',
    vendorDocUrl: 'https://portal.azure.com',
    steps: [
      'Sign in at https://portal.azure.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
