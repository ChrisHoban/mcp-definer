import { readFile } from 'node:fs/promises';

import SwaggerParser from '@apidevtools/swagger-parser';
import { validateIr } from '@mcp-definer/schemas';

import { fetchSpecFromUrl, type FetchSpecUrlOptions } from './fetch-spec-url.js';
import { normalizeSpecText } from './hash.js';
import { buildIrFromOpenApi } from './openapi/normalize.js';
import { parseSpecText } from './parse-spec-text.js';
import type { GeneratorWarning, ParseSpecOptions, ParseSpecResult, SpecInput } from './types.js';
import { mergeWarnings } from './warnings.js';

export { SpecParseError, stripMarkdownFences } from './parse-spec-text.js';

async function loadSpecDocument(
  input: SpecInput,
  fetchOptions?: FetchSpecUrlOptions,
): Promise<{ doc: Record<string, unknown>; specText: string }> {
  if (input.kind === 'url') {
    if (!fetchOptions?.allowlist?.length) {
      throw new Error('URL spec fetch requires an allow-list (SPEC_FETCH_ALLOWLIST)');
    }
    const fetched = await fetchSpecFromUrl(input.url, fetchOptions);
    const specText = normalizeSpecText(fetched.content);
    const doc = parseSpecText(specText, fetched.filename);
    return { doc, specText };
  }

  if (input.kind === 'text') {
    const specText = normalizeSpecText(input.content);
    const doc = parseSpecText(specText, input.filename);
    return { doc, specText };
  }

  const raw = await readFile(input.path, 'utf8');
  const specText = normalizeSpecText(raw);
  const doc = parseSpecText(specText, input.path);
  return { doc, specText };
}

export async function parseSpec(
  input: SpecInput,
  options: ParseSpecOptions = {},
): Promise<ParseSpecResult> {
  const warnings: GeneratorWarning[] = [];
  const { doc, specText } = await loadSpecDocument(input, options.fetch);

  let api: Record<string, unknown>;
  try {
    api = (await SwaggerParser.dereference(doc as never, {
      validate: { schema: false, spec: false },
    })) as unknown as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse API spec: ${message}`);
  }

  const ir = buildIrFromOpenApi(api, specText, warnings);
  const format = ir.source.type;

  const irValidation = validateIr(ir);
  if (!irValidation.valid) {
    const details =
      irValidation.errors?.map((e) => `${e.path}: ${e.message}`).join('; ') ?? 'Invalid IR';
    throw new Error(`IR validation failed: ${details}`);
  }

  return {
    ir,
    format,
    warnings: mergeWarnings(warnings),
    specText,
  };
}
