import { createHash } from 'node:crypto';

/** Normalize line endings for stable hashing across platforms. */
export function normalizeSpecText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function sha256SpecHash(text: string): string {
  const normalized = normalizeSpecText(text);
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `sha256:${digest}`;
}
