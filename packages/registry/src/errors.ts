export type RegistryErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'IMMUTABLE'
  | 'ALREADY_PUBLISHED';

export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  readonly statusCode: number;

  constructor(code: RegistryErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.statusCode = statusCode ?? RegistryError.defaultStatus(code);
  }

  static defaultStatus(code: RegistryErrorCode): number {
    switch (code) {
      case 'NOT_FOUND':
        return 404;
      case 'VALIDATION_FAILED':
        return 400;
      case 'CONFLICT':
      case 'IMMUTABLE':
      case 'ALREADY_PUBLISHED':
        return 409;
      default:
        return 500;
    }
  }
}
