import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { appId: 'test-app' };

describe('mobile-expo adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('mobile-expo');
    expect(adapter.label).toBeTruthy();
  });

  it('writes expo-eas-build.json during dry-run build', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('mobile-expo');
    expect(plan.platform).toBe('all');
    expect(plan.profile).toBe('preview');
    expect(plan.easBuildCommand).toBeDefined();
    expect(plan.easBuildCommand.cmd).toBe('eas');
    expect(plan.easBuildCommand.args).toContain('build');
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
  });

  it('dry-run ship exposes resolved EAS ship commands', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toBe('dry-run');
    expect(result.meta?.shipCommand).toBeDefined();
    expect(result.meta.shipCommand.cmd).toBe('eas');
    // Default: submit=false → should use update command
    expect(result.meta.shipCommand.args).toContain('update');
  });

  it('dry-run ship with submit=true uses eas submit', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const submitConfig = { appId: 'test-app', submit: true };
    const result = await adapter.ship(ctx, submitConfig);
    expect(result.meta.shipCommand.args).toContain('submit');
  });
});
