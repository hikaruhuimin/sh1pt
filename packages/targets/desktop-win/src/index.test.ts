import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { appId: 'Acme.MyApp', publisherId: 'CN=test', distribution: 'msstore' as const };

describe('desktop-win adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('desktop-win');
    expect(adapter.label).toBeTruthy();
  });

  it('writes windows-package-plan.json during dry-run build with msstore distribution', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('desktop-win');
    expect(plan.distribution).toBe('msstore');
    expect(plan.msixArtifact).toBeDefined();
    expect(plan.makeappxCommand).toBeDefined();
    expect(plan.signtoolCommand).toBeDefined();
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
  });

  it('includes msi plans when distribution is msi', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const msiConfig = { appId: 'Acme.MyApp', publisherId: 'CN=test', distribution: 'msi' as const };
    const ctx = fakeBuildContext({ dryRun: true });
    await adapter.build(ctx, msiConfig);
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.msiArtifact).toBeDefined();
    expect(plan.wixCommand).toBeDefined();
    expect(plan.msixArtifact).toBeUndefined();
    writeSpy.mockRestore();
  });

  it('surfaces follow-up when signingCertThumbprint is missing', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const ctx = fakeBuildContext({ dryRun: true });
    await adapter.build(ctx, config);
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.followUp).toContain('signingCertThumbprint');
    writeSpy.mockRestore();
  });

  it('dry-run ship returns early', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toBe('dry-run');
  });
});
