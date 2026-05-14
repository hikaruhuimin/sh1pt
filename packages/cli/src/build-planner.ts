import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { resolveInput, type ResolvedInput } from './input.js';

export interface BuildTarget {
  target: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface BuildPlan {
  input: ResolvedInput;
  targets: BuildTarget[];
}

const MANIFEST_FILES: Record<string, { target: string; confidence: BuildTarget['confidence']; reason: string }[]> = {
  'package.json': [
    { target: 'pkg-npm', confidence: 'high', reason: 'package.json found — Node.js package detected' },
  ],
  'Dockerfile': [
    { target: 'pkg-docker', confidence: 'high', reason: 'Dockerfile found — Docker image detected' },
  ],
  'docker-compose.yml': [
    { target: 'pkg-docker', confidence: 'medium', reason: 'docker-compose.yml found — Docker Compose project detected' },
  ],
  'vercel.json': [
    { target: 'deploy-vercel', confidence: 'high', reason: 'vercel.json found — Vercel deployment detected' },
  ],
  'netlify.toml': [
    { target: 'deploy-netlify', confidence: 'high', reason: 'netlify.toml found — Netlify deployment detected' },
  ],
  'app.json': [
    { target: 'mobile-expo', confidence: 'medium', reason: 'app.json found — possible Expo/React Native project' },
  ],
  'eas.json': [
    { target: 'mobile-expo', confidence: 'high', reason: 'eas.json found — Expo EAS project detected' },
  ],
  '.vscodeignore': [
    { target: 'plugin-vscode', confidence: 'high', reason: '.vscodeignore found — VS Code extension detected' },
  ],
};

/**
 * Detect likely deployment targets from a package.json's dependencies and scripts.
 */
function detectFromPackageJson(pkg: Record<string, unknown>, dir: string): BuildTarget[] {
  const targets: BuildTarget[] = [];

  // Check scripts for build hints
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const scriptValues = Object.values(scripts).join(' ');

  if (scriptValues.includes('next build') || scriptValues.includes('next start')) {
    targets.push({ target: 'web-static', confidence: 'high', reason: 'Next.js detected in scripts' });
  }
  if (scriptValues.includes('vite build')) {
    targets.push({ target: 'web-static', confidence: 'high', reason: 'Vite detected in scripts' });
  }

  // Check dependencies
  const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
  if (deps['next']) {
    targets.push({ target: 'web-static', confidence: 'high', reason: 'next dependency found' });
  }
  if (deps['expo'] || deps['expo-router']) {
    targets.push({ target: 'mobile-expo', confidence: 'high', reason: 'Expo dependency found in package.json' });
  }
  if (deps['@vscode/vsce'] || deps['vsce']) {
    targets.push({ target: 'plugin-vscode', confidence: 'high', reason: 'vsce dependency found in package.json' });
  }

  // Check for web-static indicators
  const indexHtml = existsSync(join(dir, 'index.html'));
  if (indexHtml) {
    targets.push({ target: 'web-static', confidence: 'medium', reason: 'index.html found in project root' });
  }

  // Check for desktop targets
  if (deps['electron'] || deps['@electron-forge/cli']) {
    targets.push({ target: 'desktop-win', confidence: 'medium', reason: 'Electron dependency found — desktop target possible' });
  }

  // Always add pkg-npm if package.json exists (unless already added)
  if (!targets.some(t => t.target === 'pkg-npm')) {
    targets.push({ target: 'pkg-npm', confidence: 'medium', reason: 'package.json present — npm package possible' });
  }

  return targets;
}

/**
 * Scan a local directory for manifest files and infer likely build targets.
 */
function scanDirectory(dir: string): BuildTarget[] {
  const targets: BuildTarget[] = [];

  for (const [file, suggestions] of Object.entries(MANIFEST_FILES)) {
    if (existsSync(join(dir, file))) {
      for (const s of suggestions) {
        // De-duplicate
        if (!targets.some(t => t.target === s.target)) {
          targets.push({ ...s, reason: `${file}: ${s.reason}` });
        }
      }
    }
  }

  // Deep-scan package.json for more signals
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const pkgTargets = detectFromPackageJson(pkg, dir);
      for (const t of pkgTargets) {
        if (!targets.some(e => e.target === t.target && e.confidence === 'high')) {
          targets.push(t);
        }
      }
    } catch {
      // Malformed package.json — skip deep scan
    }
  }

  return targets;
}

/**
 * Build an offline plan from a `--from` input without fetching or probing
 * network resources. Classifies remote git/URL inputs safely.
 */
export function planBuildFrom(rawInput: string): BuildPlan {
  const input = resolveInput(rawInput);

  // Remote inputs: classify without fetching
  if (input.kind === 'git' || input.kind === 'url') {
    return {
      input,
      targets: [
        { target: 'unknown', confidence: 'low', reason: `remote ${input.kind} input — clone and scan locally for precise targets` },
      ],
    };
  }

  // Doc inputs: try to parse as manifest
  if (input.kind === 'doc') {
    const targets: BuildTarget[] = [];
    if (input.exists && extname(input.value).toLowerCase() === '.json') {
      try {
        const content = JSON.parse(readFileSync(input.value, 'utf-8'));
        if (content.name || content.version || content.scripts) {
          targets.push(...detectFromPackageJson(content, resolve(input.value, '..')));
        }
      } catch {
        // Not valid JSON — skip
      }
    }
    if (targets.length === 0) {
      targets.push({ target: 'unknown', confidence: 'low', reason: 'document input — could not infer targets automatically' });
    }
    return { input, targets };
  }

  // Local path: scan directory
  if (input.kind === 'path') {
    if (!input.exists) {
      return {
        input,
        targets: [
          { target: 'unknown', confidence: 'low', reason: `path does not exist: ${input.value}` },
        ],
      };
    }

    const stat = statSync(input.value);
    if (!stat.isDirectory()) {
      return {
        input,
        targets: [
          { target: 'unknown', confidence: 'low', reason: 'input is a file, not a directory' },
        ],
      };
    }

    const targets = scanDirectory(input.value);
    if (targets.length === 0) {
      targets.push({ target: 'unknown', confidence: 'low', reason: 'no recognized manifest files found in directory' });
    }
    return { input, targets };
  }

  return {
    input,
    targets: [
      { target: 'unknown', confidence: 'low', reason: 'unrecognized input kind' },
    ],
  };
}

/**
 * Format a build plan for human-readable output.
 */
export function formatPlan(plan: BuildPlan): string {
  const lines: string[] = [];
  lines.push(`Build plan for: ${plan.input.raw}`);
  lines.push(`  Input kind: ${plan.input.kind}`);
  lines.push(`  Inferred targets:`);
  for (const t of plan.targets) {
    const badge = t.confidence === 'high' ? '●' : t.confidence === 'medium' ? '○' : '◌';
    lines.push(`    ${badge} ${t.target} (${t.confidence}) — ${t.reason}`);
  }
  return lines.join('\n');
}
