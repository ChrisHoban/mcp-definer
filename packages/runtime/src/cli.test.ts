import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { ManifestLoadError } from './manifest-loader.js';
import { parseArgs, runRuntimeCli } from './cli.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

const { loadManifestMock, serveStdioMock } = vi.hoisted(() => ({
  loadManifestMock: vi.fn(),
  serveStdioMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./manifest-loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./manifest-loader.js')>();
  return {
    ...actual,
    loadManifest: loadManifestMock,
  };
});

vi.mock('./server.js', () => ({
  serveStdio: serveStdioMock,
}));

describe('runtime parseArgs', () => {
  it('reads --manifest flag values', () => {
    expect(parseArgs(['--manifest', '/tmp/manifest.json'])).toEqual({
      manifest: '/tmp/manifest.json',
    });
    expect(parseArgs(['--manifest=/tmp/inline.json'])).toEqual({
      manifest: '/tmp/inline.json',
    });
  });
});

describe('runRuntimeCli', () => {
  it('loads manifest and starts stdio server', async () => {
    const manifestPath = join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    loadManifestMock.mockResolvedValueOnce(manifest);

    await runRuntimeCli(['--manifest', manifestPath]);

    expect(loadManifestMock).toHaveBeenCalledWith(manifestPath);
    expect(serveStdioMock).toHaveBeenCalledWith(manifest);
  });

  it('propagates manifest load failures', async () => {
    loadManifestMock.mockRejectedValueOnce(new ManifestLoadError('Invalid manifest: missing name'));
    await expect(runRuntimeCli(['--manifest', 'bad.json'])).rejects.toThrow(/Invalid manifest/);
  });
});
