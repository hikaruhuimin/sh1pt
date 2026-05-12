import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-groq',
  label: 'Groq',
  defaultModel: 'llama-3.3-70b-versatile',
  models: ['llama-3.3-70b-versatile'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-groq · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-groq integration not yet implemented]', model: 'llama-3.3-70b-versatile' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'GROQ_API_KEY',
    label: 'Groq',
    vendorDocUrl: 'https://console.groq.com',
    steps: [
      'Sign in at https://console.groq.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
