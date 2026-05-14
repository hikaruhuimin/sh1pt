import { describe, it, expect, vi } from 'vitest';
import adapter from './index.js';
import { fakeBuildContext, fakeShipContext } from '@profullstack/sh1pt-core/testing';

const config = { publisher: 'mycompany', extensionName: 'my-extension' };

describe('plugin-vscode adapter', () => {
  it('exports correct id and label', () => {
    expect(adapter.id).toBe('plugin-vscode');
    expect(adapter.label).toBeTruthy();
  });

  it('short-circuits dry-run build before vsce/npm exec checks', async () => {
    const writeSpy = vi.spyOn(await import('node:fs'), 'writeFileSync').mockImplementation(() => {});
    const execSpy = vi.spyOn(await import('@profullstack/sh1pt-core'), 'exec').mockImplementation(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const ctx = fakeBuildContext({ dryRun: true });
    const result = await adapter.build(ctx, config);
    // dry-run should NOT call exec
    expect(execSpy).not.toHaveBeenCalled();
    // dry-run should write the plan file
    expect(writeSpy).toHaveBeenCalled();
    const planArg = writeSpy.mock.calls[0][1];
    const plan = JSON.parse(planArg);
    expect(plan.target).toBe('plugin-vscode');
    expect(plan.packageDir).toBeDefined();
    expect(plan.expectedVsix).toContain('my-extension');
    expect(plan.vsceCommand).toBeDefined();
    expect(plan.vsceCommand.cmd).toBe('npx');
    expect(result.meta?.plan).toBeDefined();
    writeSpy.mockRestore();
    execSpy.mockRestore();
  });

  it('dry-run ship returns early', async () => {
    const ctx = fakeShipContext({ dryRun: true, secret: () => 'fake-token' });
    const result = await adapter.ship(ctx, config);
    expect(result.id).toBe('dry-run');
  });
});
