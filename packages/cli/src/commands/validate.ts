import { readFileSync } from 'node:fs';

import { validateManifest } from '@mcp-definer/schemas';

export async function runValidate(args: string[]): Promise<number> {
  const manifestPath = args[0];
  if (!manifestPath) {
    console.error('Usage: mcp-definer validate <manifest.json>');
    return 1;
  }

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (error) {
    console.error(`Cannot read ${manifestPath}: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`Invalid JSON: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  const result = validateManifest(parsed);
  if (result.valid) {
    console.log('Manifest is valid.');
    if (result.warnings?.length) {
      for (const warning of result.warnings) {
        console.warn(`  warning ${warning.path}: ${warning.message}`);
      }
    }
    return 0;
  }

  console.error('Manifest validation failed:');
  for (const issue of result.errors ?? []) {
    console.error(`  ${issue.path}: ${issue.message}`);
  }
  return 1;
}
