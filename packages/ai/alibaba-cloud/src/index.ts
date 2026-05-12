import { defineAi, tokenSetup } from '@profullstack/sh1pt-core';

interface Config {
  baseUrl?: string;
}

export default defineAi<Config>({
  id: 'ai-alibaba-cloud',
  label: 'Alibaba Cloud Int.',
  defaultModel: 'qwen-max',
  models: ['qwen-max'],

  async generate(ctx, prompt, _opts, _config) {
    const apiKey = ctx.secret('DASHSCOPE_API_KEY');
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY not in vault — run `sh1pt promote ai setup`');
    ctx.log(`[stub] ai-alibaba-cloud · ${prompt.length} chars in — integration pending`);
    return { text: '[stub — ai-alibaba-cloud integration not yet implemented]', model: 'qwen-max' };
  },

  setup: tokenSetup<Config>({
    secretKey: 'DASHSCOPE_API_KEY',
    label: 'Alibaba Cloud Int.',
    vendorDocUrl: 'https://dashscope-intl.console.aliyun.com',
    steps: [
      'Sign in at https://dashscope-intl.console.aliyun.com and create an API key',
      'Copy the key — usually shown once',
      'Paste below; sh1pt encrypts it in the vault',
    ],
  }),
});
