import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-zai',
  label: 'Z.ai',
  defaultModel: 'glm-4.5',
  models: ['glm-4.5'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('ZAI_API_KEY');
    if (!apiKey) throw new Error('ZAI_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-zai · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-zai integration not yet implemented]', model: 'glm-4.5' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'ZAI_API_KEY',
    label: 'Z.ai',
    vendorDocUrl: 'https://z.ai',
    steps: [
      'Sign in at https://z.ai and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
