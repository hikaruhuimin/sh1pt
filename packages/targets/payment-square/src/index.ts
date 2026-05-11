import { defineTarget, exec } from '@profullstack/sh1pt-core';

interface Config {
  command?: 'create' | 'get' | 'cancel' | 'list' | 'refund';
  args?: Record<string, unknown>;
  locationId?: string;
}

export default defineTarget<Config>({
  id: 'payment-square',
  kind: 'payment',
  label: 'Square (CLI wrapper)',

  async build(ctx, config) {
    ctx.log('square: verifying CLI availability');
    const cmd = config.command || 'list';

    const key = ctx.secret('SQUARE_ACCESS_TOKEN');
    if (!key) throw new Error('SQUARE_ACCESS_TOKEN not set');

    const location = config.locationId || ctx.secret('SQUARE_LOCATION_ID') || 'main';

    switch (cmd) {
      case 'create': {
        const amount = config.args?.amount || 0;
        const currency = config.args?.currency || 'USD';
        const sourceId = config.args?.sourceId || '';
        ctx.log(`square: creating payment of ${amount} ${currency}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          'https://connect.squareup.com/v2/payments',
          '-H', `Authorization: Bearer ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            source_id: sourceId,
            idempotency_key: `sh1pt-${Date.now()}`,
            amount_money: { amount, currency },
            location_id: location,
          })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'get': {
        const id = config.args?.paymentId as string || '';
        ctx.log(`square: getting payment ${id}`);
        const r = await exec('curl', [
          '-s', `https://connect.squareup.com/v2/payments/${id}`,
          '-H', `Authorization: Bearer ${key}`
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'cancel': {
        const id = config.args?.paymentId as string || '';
        ctx.log(`square: canceling payment ${id}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `https://connect.squareup.com/v2/payments/${id}/cancel`,
          '-H', `Authorization: Bearer ${key}`,
          '-H', 'Content-Type: application/json'
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'list': {
        ctx.log('square: listing payments');
        const r = await exec('curl', [
          '-s', `https://connect.squareup.com/v2/payments`,
          '-H', `Authorization: Bearer ${key}`
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      case 'refund': {
        const id = config.args?.paymentId as string || '';
        ctx.log(`square: refunding payment ${id}`);
        const r = await exec('curl', [
          '-s', '-X', 'POST',
          `https://connect.squareup.com/v2/refunds`,
          '-H', `Authorization: Bearer ${key}`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            idempotency_key: `sh1pt-${Date.now()}`,
            payment_id: id,
            amount_money: config.args?.amount,
            reason: config.args?.reason || 'requested_by_customer',
          })
        ], { log: ctx.log });
        return { output: r.stdout };
      }
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  },

  async ship(ctx, _config) {
    ctx.log('square: verifying setup');
    const key = ctx.secret('SQUARE_ACCESS_TOKEN');
    if (!key) {
      return setupGuide({
        title: 'Square Access Token',
        steps: [
          '1. Go to https://developer.squareup.com/apps',
          '2. Create or select your app',
          '3. Go to Credentials → Access Token',
          '4. Copy your Sandbox or Production token',
          '5. Run: sh1pt secret set SQUARE_ACCESS_TOKEN <token>',
          'Optional: sh1pt secret set SQUARE_LOCATION_ID <id>',
        ],
      });
    }
    return { status: 'ready' };
  },
});
