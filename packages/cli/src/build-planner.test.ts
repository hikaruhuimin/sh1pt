import { describe, it, expect, vi } from 'vitest';
import { planBuildFrom, formatPlan } from './build-planner.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURE_DIR = join(tmpdir(), 'sh1pt-build-planner-test');

// Setup fixture directory
beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'package.json'), JSON.stringify({
    name: 'test-app',
    version: '1.0.0',
    scripts: { build: 'next build' },
    dependencies: { next: '14.0.0' },
  }));
  writeFileSync(join(FIXTURE_DIR, 'vercel.json'), '{}');
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe('planBuildFrom', () => {
  it('classifies git URLs without fetching', () => {
    const plan = planBuildFrom('https://github.com/profullstack/sh1pt');
    expect(plan.input.kind).toBe('git');
    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].target).toBe('unknown');
    expect(plan.targets[0].confidence).toBe('low');
  });

  it('classifies SSH git URLs without fetching', () => {
    const plan = planBuildFrom('git@github.com:profullstack/sh1pt.git');
    expect(plan.input.kind).toBe('git');
    expect(plan.targets[0].target).toBe('unknown');
  });

  it('classifies generic URLs without fetching', () => {
    const plan = planBuildFrom('https://example.com/pricing');
    expect(plan.input.kind).toBe('url');
    expect(plan.targets[0].target).toBe('unknown');
  });

  it('scans a local directory for manifest files', () => {
    const plan = planBuildFrom(FIXTURE_DIR);
    expect(plan.input.kind).toBe('path');
    const targetIds = plan.targets.map(t => t.target);
    expect(targetIds).toContain('deploy-vercel');
    expect(targetIds).toContain('pkg-npm');
  });

  it('detects Next.js from package.json scripts', () => {
    const plan = planBuildFrom(FIXTURE_DIR);
    const webTarget = plan.targets.find(t => t.target === 'web-static');
    expect(webTarget).toBeDefined();
    expect(webTarget!.confidence).toBe('high');
  });

  it('handles non-existent paths', () => {
    const plan = planBuildFrom('/tmp/nonexistent-sh1pt-test-dir-xyz');
    expect(plan.targets[0].target).toBe('unknown');
    expect(plan.targets[0].confidence).toBe('low');
  });

  it('detects Expo from eas.json manifest file', () => {
    const expoDir = join(tmpdir(), 'sh1pt-expo-test');
    mkdirSync(expoDir, { recursive: true });
    writeFileSync(join(expoDir, 'eas.json'), JSON.stringify({ build: {} }));
    const plan = planBuildFrom(expoDir);
    const expoTarget = plan.targets.find(t => t.target === 'mobile-expo');
    expect(expoTarget).toBeDefined();
    expect(expoTarget!.confidence).toBe('high');
    rmSync(expoDir, { recursive: true, force: true });
  });

  it('detects VS Code extension from .vscodeignore', () => {
    const vscodeDir = join(tmpdir(), 'sh1pt-vscode-test');
    mkdirSync(vscodeDir, { recursive: true });
    writeFileSync(join(vscodeDir, '.vscodeignore'), 'node_modules/**');
    writeFileSync(join(vscodeDir, 'package.json'), JSON.stringify({ name: 'test-ext' }));
    const plan = planBuildFrom(vscodeDir);
    const vscodeTarget = plan.targets.find(t => t.target === 'plugin-vscode');
    expect(vscodeTarget).toBeDefined();
    expect(vscodeTarget!.confidence).toBe('high');
    rmSync(vscodeDir, { recursive: true, force: true });
  });

  it('detects Docker from Dockerfile', () => {
    const dockerDir = join(tmpdir(), 'sh1pt-docker-test');
    mkdirSync(dockerDir, { recursive: true });
    writeFileSync(join(dockerDir, 'Dockerfile'), 'FROM node:18');
    const plan = planBuildFrom(dockerDir);
    const dockerTarget = plan.targets.find(t => t.target === 'pkg-docker');
    expect(dockerTarget).toBeDefined();
    expect(dockerTarget!.confidence).toBe('high');
    rmSync(dockerDir, { recursive: true, force: true });
  });
});

describe('formatPlan', () => {
  it('produces human-readable output', () => {
    const plan = planBuildFrom(FIXTURE_DIR);
    const output = formatPlan(plan);
    expect(output).toContain('Build plan for:');
    expect(output).toContain('Input kind:');
    expect(output).toContain('Inferred targets:');
  });
});
