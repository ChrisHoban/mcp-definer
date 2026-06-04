import { parse as parseYaml } from 'yaml';

export class SpecParseError extends Error {
  override readonly name = 'SpecParseError';

  constructor(message: string) {
    super(message);
  }
}

/** Strip optional markdown code fences from pasted specs. */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:yaml|yml|json|openapi)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(trimmed);
  return match ? match[1] : text;
}

type SpecTextFormat = 'json' | 'yaml';

function inferFormat(filename: string | undefined, trimmed: string): SpecTextFormat {
  const lower = filename?.toLowerCase() ?? '';
  if (lower.endsWith('.json')) {
    return 'json';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'yaml';
}

function tryParseJson(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

function tryParseYaml(content: string): Record<string, unknown> {
  const doc = parseYaml(content);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new SyntaxError('YAML did not resolve to an OpenAPI document object');
  }
  return doc as Record<string, unknown>;
}

/**
 * Parse raw OpenAPI/Swagger text. Honors filename extension; falls back across
 * JSON/YAML when the primary parser fails (common for pasted specs).
 */
export function parseSpecText(content: string, filename?: string): Record<string, unknown> {
  const stripped = stripMarkdownFences(content);
  const trimmed = stripped.trim();
  if (!trimmed) {
    throw new SpecParseError('Spec content is empty');
  }

  const primary = inferFormat(filename, trimmed);
  const attempts: Array<{ label: string; fn: () => Record<string, unknown> }> = [];

  if (primary === 'yaml') {
    attempts.push({ label: 'YAML', fn: () => tryParseYaml(stripped) });
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      attempts.push({ label: 'JSON', fn: () => tryParseJson(stripped) });
    }
  } else {
    attempts.push({ label: 'JSON', fn: () => tryParseJson(stripped) });
    attempts.push({ label: 'YAML', fn: () => tryParseYaml(stripped) });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      return attempt.fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.label}: ${message}`);
    }
  }

  throw new SpecParseError(
    `Could not parse the spec. ${errors.join(' · ')}`,
  );
}
