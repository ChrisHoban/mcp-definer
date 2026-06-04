/**
 * Deterministic JSON serialization for Manifest round-trips (NFR-06).
 *
 * Rules:
 * - Object keys are sorted lexicographically (UTF-16 code unit order).
 * - Arrays preserve source order (tool order is semantic).
 * - No insignificant whitespace.
 * - undefined omitted; null preserved.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const item = record[key];
    if (item !== undefined) {
      result[key] = canonicalize(item);
    }
  }

  return result;
}

export function serializeCanonical(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function parseManifestJson<T = unknown>(json: string): T {
  return JSON.parse(json) as T;
}

export function roundTripDeterministic(value: unknown): boolean {
  const first = serializeCanonical(value);
  const parsed = JSON.parse(first) as unknown;
  const second = serializeCanonical(parsed);
  return first === second;
}
