import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { bundleId: 'com.example.MyExtension' };

describe('browser-safari adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('browser-safari');
    expect(adapter.label).toBeTruthy();
  });

  it('writes safari-package-plan.json during dry-run build before Xcode checks', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const execSpy = vi.spyOn(await import('@profullstack/sh1pt-core'), 'exec').mockImplementation(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    // dry-run should NOT call exec
    expect(execSpy).not.toHaveBeenCalled();
    // dry-run should write the plan
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('browser-safari');
    expect(plan.bundleId).toBe('com.example.MyExtension');
    expect(plan.converterCommand).toBeDefined();
    expect(plan.xcodeBuildCommand).toBeDefined();
    expect(plan.converterCommand.cmd).toBe('xcrun');
    expect(plan.xcodeBuildCommand.cmd).toBe('xcodebuild');
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
    execSpy.mockRestore();
  });

  it('dry-run ship returns early without network calls', async () => {
    const ctx = fakeShipContext({ dryRun: true });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toContain('com.example.MyExtension');
  });
});
