import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateManifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runValidate } from './commands/validate.js';
import { readMcpConfig } from './mcp-config.js';

const repoRoot = join(import.meta.dirname, '../../..');

describe('CLI validate', () => {
  it('validates fixture manifest', async () => {
    const manifestPath = join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json');
    const code = await runValidate([manifestPath]);
    expect(code).toBe(0);
  });

  it('returns non-zero for invalid manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-definer-cli-'));
    const badPath = join(dir, 'bad.json');
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(badPath, '{"name":"x"}'),
    );

    try {
      const code = await runValidate([badPath]);
      expect(code).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('CLI list --local', () => {
  it('lists petstore from local fixture', async () => {
    const code = await runList([], { local: true });
    expect(code).toBe(0);
  });
});

describe('CLI install --local', () => {
  it('writes valid Cursor config and prompts can be skipped with --yes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-definer-cli-'));
    const configPath = join(dir, 'mcp.json');

    try {
      const code = await runInstall(['acme/petstore'], {
        local: true,
        configPath,
        yes: true,
      });
      expect(code).toBe(0);

      const config = await readMcpConfig(configPath);
      expect(config.mcpServers?.petstore).toBeDefined();
      expect(config.mcpServers?.petstore.command).toBe('npx');
      expect(config.mcpServers?.petstore.args).toContain('@mcp-definer/runtime');
      expect(config.mcpServers?.petstore.args?.some((a) => a.includes('/manifest'))).toBe(true);
      expect(config.mcpServers?.petstore.env?.MCP_DEFINER_SECRET_cb_petstore_apikey).toBeDefined();

      expect(config.mcpServers?.petstore.args?.at(-1)).toMatch(
        /\/v1\/registry\/acme\/petstore\/versions\/1\.0\.0\/manifest/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('validateManifest integration', () => {
  it('fixture passes shared validator used by CLI', async () => {
    const raw = await readFile(join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json'), 'utf8');
    const result = validateManifest(JSON.parse(raw));
    expect(result.valid).toBe(true);
  });
});
