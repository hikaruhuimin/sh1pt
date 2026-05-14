import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { productId: 'test-product-id' };

describe('browser-edge adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('browser-edge');
    expect(adapter.label).toBeTruthy();
  });

  it('writes edge-package-plan.json during dry-run build', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('browser-edge');
    expect(plan.productId).toBe('test-product-id');
    expect(plan.expectedArtifact).toContain('test-product-id');
    expect(plan.zipCommand).toBeDefined();
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
  });

  it('dry-run ship returns early without network calls', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toContain('test-product-id');
  });
});
