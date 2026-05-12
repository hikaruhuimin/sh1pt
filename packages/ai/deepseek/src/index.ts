import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-deepseek',
  label: 'DeepSeek',
  defaultModel: 'deepseek-chat',
  models: ['deepseek-chat'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('DEEPSEEK_API_KEY');
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-deepseek · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-deepseek integration not yet implemented]', model: 'deepseek-chat' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'DEEPSEEK_API_KEY',
    label: 'DeepSeek',
    vendorDocUrl: 'https://platform.deepseek.com',
    steps: [
      'Sign in at https://platform.deepseek.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
