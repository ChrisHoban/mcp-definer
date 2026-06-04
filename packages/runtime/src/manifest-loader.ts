import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { validateManifest, type Manifest } from '@mcp-definer/schemas';

export class ManifestLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestLoadError';
  }
}

function isUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

async function loadManifestFromUrl(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ManifestLoadError(`Failed to fetch manifest from ${url}: HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

function loadManifestFromPath(path: string): unknown {
  const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const raw = readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

export async function loadManifest(source: string): Promise<Manifest> {
  const payload = isUrl(source) ? await loadManifestFromUrl(source) : loadManifestFromPath(source);
  const validation = validateManifest(payload);

  if (!validation.valid) {
    const details = (validation.errors ?? []).map((issue) => issue.message).join('; ');
    throw new ManifestLoadError(`Invalid manifest: ${details}`);
  }

  return payload as Manifest;
}

export function resolveManifestSource(cliManifest?: string): string {
  const fromCli = cliManifest?.trim();
  if (fromCli) {
    return fromCli;
  }

  const fromEnv = process.env.MCP_DEFINER_MANIFEST_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  throw new ManifestLoadError(
    'Manifest source required: pass --manifest <path|url> or set MCP_DEFINER_MANIFEST_URL',
  );
}
