import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-xai',
  label: 'xAI',
  defaultModel: 'grok-3',
  models: ['grok-3'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('XAI_API_KEY');
    if (!apiKey) throw new Error('XAI_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-xai · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-xai integration not yet implemented]', model: 'grok-3' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'XAI_API_KEY',
    label: 'xAI',
    vendorDocUrl: 'https://console.x.ai',
    steps: [
      'Sign in at https://console.x.ai and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
