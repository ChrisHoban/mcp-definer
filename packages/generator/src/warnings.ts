import type { GeneratorWarning } from './types.js';

export function warn(
  code: string,
  message: string,
  path?: string,
): GeneratorWarning {
  return path ? { code, message, path } : { code, message };
}

export function mergeWarnings(...groups: GeneratorWarning[][]): GeneratorWarning[] {
  return groups.flat();
}
