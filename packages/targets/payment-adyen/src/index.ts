import { defineTarget, exec } from '@profullstack/sh1pt-core';

interface Config {
  command?: 'payment' | 'capture' | 'refund' | 'cancel' | 'status';
  args?: Record<string, unknown>;
}

export default defineTarget<Config>({
  id: 'payment-adyen',
  kind: 'payment',
  label: 'Adyen (CLI wrapper)',

  async build(ctx, config) {
    ctx.log('adyen: verifying API access');
    const cmd = config.command || 'status';

    const key = ctx.secret('ADYEN_API_KEY');
    const merchant = ctx.secret('ADYEN_MERCHANT_ACCOUNT');
    if (!key) throw new Error('ADYEN_API_KEY not set');
    if (!merchant) throw new Error('ADYEN_MERCHANT_ACCOUNT not set');

    const base = 'https://checkout-test.adyen.com/v71';

    switch (cmd) {
      case 'payment': {
        const amount = config.args?.amount || 0;
        const currency = config.args?.currency || 'USD';
        const ref = `sh1pt-${Date.now()}`;
        ctx.log(`adyen: creating payment of ${amount} ${currency}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `${base}/payments`,
          '-H', `X-API-Key: ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            amount: { value: amount, currency },
            reference: ref,
            merchantAccount: merchant,
            channel: 'web',
            returnUrl: 'https://sh1pt.com/adyen/redirect',
          })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'capture': {
        const psp = config.args?.pspReference as string || '';
        const amount = config.args?.amount;
        ctx.log(`adyen: capturing payment ${psp}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `${base}/payments/${psp}/captures`,
          '-H', `X-API-Key: ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            merchantAccount: merchant,
            amount: amount ? { value: amount, currency: config.args?.currency || 'USD' } : undefined,
          })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'refund': {
        const psp = config.args?.pspReference as string || '';
        ctx.log(`adyen: refunding payment ${psp}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `${base}/payments/${psp}/refunds`,
          '-H', `X-API-Key: ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            merchantAccount: merchant,
            amount: config.args?.amount,
          })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'cancel': {
        const psp = config.args?.pspReference as string || '';
        ctx.log(`adyen: canceling payment ${psp}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `${base}/payments/${psp}/cancels`,
          '-H', `X-API-Key: ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({ merchantAccount: merchant })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'status': {
        const psp = config.args?.pspReference as string || '';
        ctx.log(`adyen: checking status of ${psp || 'all'}`);
        const endpoint = psp ? `${base}/payments/${psp}` : `${base}/payments`;
        const r = await exec('curl', [
          '-s', endpoint,
          '-H', `X-API-Key: ${key}`
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  },

  async ship(ctx, _config) {
    ctx.log('adyen: verifying setup');
    const key = ctx.secret('ADYEN_API_KEY');
    if (!key || !ctx.secret('ADYEN_MERCHANT_ACCOUNT')) {
      const { setupGuide } = await import('@profullstack/sh1pt-core');
      return setupGuide({
        title: 'Adyen API Key & Merchant Account',
        steps: [
          '1. Go to https://ca-test.adyen.com (test) or https://ca-live.adyen.com (live)',
          '2. Settings → API credentials → Generate API key',
          '3. Copy your Merchant Account name from Settings → General',
          '4. Run: sh1pt secret set ADYEN_API_KEY <key>',
          '5. Run: sh1pt secret set ADYEN_MERCHANT_ACCOUNT <account>',
        ],
      });
    }
    return { status: 'ready' };
  },
});
