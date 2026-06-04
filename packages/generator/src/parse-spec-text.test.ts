import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseSpecText, SpecParseError, stripMarkdownFences } from './parse-spec-text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

describe('parseSpecText', () => {
  it('parses JSON petstore body when filename is .yaml (repo fixture)', () => {
    const content = readFileSync(join(repoRoot, 'fixtures/openapi/petstore.yaml'), 'utf8');
    const doc = parseSpecText(content, 'openapi.yaml');
    expect(doc.swagger).toBe('2.0');
  });

  it('parses YAML messy-spec with openapi.yaml filename', () => {
    const content = readFileSync(join(repoRoot, 'fixtures/openapi/messy-spec.yaml'), 'utf8');
    const doc = parseSpecText(content, 'openapi.yaml');
    expect(doc.openapi).toBe('3.0.3');
  });

  it('parses JSON when filename is .json', () => {
    const content = readFileSync(join(repoRoot, 'fixtures/openapi/petstore.yaml'), 'utf8');
    const doc = parseSpecText(content, 'petstore.json');
    expect(doc.swagger).toBe('2.0');
  });

  it('strips markdown fences before parsing', () => {
    const inner = 'openapi: 3.0.3\ninfo:\n  title: Demo\n  version: 1.0.0\npaths: {}\n';
    const fenced = `\`\`\`yaml\n${inner}\`\`\``;
    expect(stripMarkdownFences(fenced).trimEnd()).toBe(inner.trimEnd());
    const doc = parseSpecText(fenced, 'openapi.yaml');
    expect(doc.openapi).toBe('3.0.3');
  });

  it('throws SpecParseError with both parser messages when content is invalid', () => {
    expect(() => parseSpecText('{ not valid json or yaml: [', 'openapi.yaml')).toThrow(
      SpecParseError,
    );
    try {
      parseSpecText('{ not valid json or yaml: [', 'openapi.yaml');
    } catch (error) {
      expect((error as SpecParseError).message).toMatch(/Could not parse the spec/);
      expect((error as SpecParseError).message).toMatch(/YAML:/);
      expect((error as SpecParseError).message).toMatch(/JSON:/);
    }
  });
});
