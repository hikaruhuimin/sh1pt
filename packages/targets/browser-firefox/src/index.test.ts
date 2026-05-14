import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { extensionId: 'test-ext@example.com' };

describe('browser-firefox adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('browser-firefox');
    expect(adapter.label).toBeTruthy();
  });

  it('writes firefox-package-plan.json during dry-run build', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('browser-firefox');
    expect(plan.extensionId).toBe('test-ext@example.com');
    expect(plan.amoChannel).toBe('listed');
    expect(plan.webExtBuildCommand).toBeDefined();
    expect(plan.webExtBuildCommand.cmd).toBe('web-ext');
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
  });

  it('dry-run ship returns side-effect free with command metadata', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toBe('dry-run');
    expect(result.meta?.shipPlan).toBeDefined();
    expect(result.meta.shipPlan.webExtSignCommand).toBeDefined();
  });
});
