import { defineTarget, exec, manualSetup } from '@profullstack/sh1pt-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

interface Config {
  serviceId?: string;
  blueprint?: string;
  deployHookUrl?: string;
  waitForDeploy?: boolean;
}

function blueprintPath(ctx: { projectDir: string }, config: Config): string {
  const blueprint = config.blueprint ?? 'render.yaml';
  return isAbsolute(blueprint) ? blueprint : join(ctx.projectDir, blueprint);
}

function renderPlan(ctx: { projectDir: string; version: string }, config: Config): string {
  return `${JSON.stringify({
    provider: 'render',
    serviceId: config.serviceId ?? null,
    blueprint: blueprintPath(ctx, config),
    trigger: config.deployHookUrl ? 'deploy-hook' : 'cli',
    waitForDeploy: config.waitForDeploy ?? false,
    version: ctx.version,
  }, null, 2)}\n`;
}

async function blueprintExists(path: string): Promise<boolean> {
  try {
    await readFile(path, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function deployArgs(config: Config): string[] {
  const args = ['deploy'];
  if (config.serviceId) args.push('--service', config.serviceId);
  if (config.waitForDeploy) args.push('--wait');
  return args;
}

function parseDeployResponse(stdout: string, serviceId: string | undefined, version: string): { id: string; url?: string } {
  // Render CLI outputs lines like:
  // Deploy started: <deploy-id> for service <service-id>
  // or JSON when --json flag is used (not available in all versions)
  const deployMatch = stdout.match(/deploy\s+(?:started|created)[:\s]+([a-zA-Z0-9-]+)/i);
  const id = deployMatch?.[1] ?? `${serviceId ?? 'render'}@${version}`;

  const url = serviceId
    ? `https://dashboard.render.com/web/${serviceId}`
    : undefined;

  return { id, url };
}

export default defineTarget<Config>({
  id: 'deploy-render',
  kind: 'web',
  label: 'Render',
  async build(ctx, config) {
    const planPath = join(ctx.outDir, 'render-deploy.json');
    const blueprint = blueprintPath(ctx, config);
    ctx.log(`render blueprint validate ${config.blueprint ?? 'render.yaml'}`);
    await mkdir(ctx.outDir, { recursive: true });
    await writeFile(planPath, renderPlan(ctx, config), 'utf-8');
    if (!(await blueprintExists(blueprint))) {
      ctx.log(`Render blueprint not found at ${blueprint}; continuing with deploy plan only`, 'warn');
    }
    return { artifact: planPath };
  },
  async ship(ctx, config) {
    const method = config.deployHookUrl ? 'deploy-hook' : 'cli';
    ctx.log(`render deploys create · service=${config.serviceId ?? 'linked'} · method=${method}`);
    if (ctx.dryRun) return { id: 'dry-run', meta: { command: ['render', ...deployArgs(config)] } };

    // Support deploy hook URL directly (no CLI needed for hooks)
    if (config.deployHookUrl) {
      const res = await fetch(config.deployHookUrl, { method: 'POST' });
      if (!res.ok) throw new Error(`Render deploy hook failed (${res.status})`);
      return {
        id: `deploy-hook-${Date.now()}`,
        url: config.serviceId ? `https://dashboard.render.com/web/${config.serviceId}` : undefined,
      };
    }

    // Use Render CLI for API-based deploys
    const token = ctx.secret('RENDER_API_KEY');
    if (!token) {
      throw new Error('RENDER_API_KEY not in vault — run: sh1pt secret set RENDER_API_KEY <token>');
    }

    const result = await exec('render', deployArgs(config), {
      cwd: ctx.projectDir,
      env: { ...ctx.env, RENDER_API_KEY: token },
      log: ctx.log,
      throwOnNonZero: true,
    });

    const deployed = parseDeployResponse(result.stdout, config.serviceId, ctx.version);
    return {
      id: deployed.id,
      url: deployed.url,
    };
  },
  setup: manualSetup({
    label: 'Render CLI',
    vendorDocUrl: 'https://render.com/docs/cli',
    steps: [
      'Install the Render CLI from the official docs',
      'Authenticate: render login',
      'For CI: sh1pt secret set RENDER_API_KEY <token>',
    ],
  }),
});
