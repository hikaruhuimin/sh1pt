import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-cloudflare',
  label: 'Cloudflare Workers AI',
  defaultModel: '@cf/meta/llama-3.3-70b-instruct',
  models: ['@cf/meta/llama-3.3-70b-instruct'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('CLOUDFLARE_API_TOKEN');
    if (!apiKey) throw new Error('CLOUDFLARE_API_TOKEN not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-cloudflare · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-cloudflare integration not yet implemented]', model: '@cf/meta/llama-3.3-70b-instruct' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'CLOUDFLARE_API_TOKEN',
    label: 'Cloudflare Workers AI',
    vendorDocUrl: 'https://dash.cloudflare.com',
    steps: [
      'Sign in at https://dash.cloudflare.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
