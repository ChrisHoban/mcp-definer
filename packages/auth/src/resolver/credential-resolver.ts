import type { HttpRequest } from '../types/http.js';
import type { ResolvedCredential } from './resolved-credential.js';

export interface CredentialResolver {
  resolve(bindingId: string): Promise<ResolvedCredential>;
  apply(credential: ResolvedCredential, request: HttpRequest): HttpRequest;
}

export class CredentialResolutionError extends Error {
  constructor(
    message: string,
    public readonly bindingId?: string,
  ) {
    super(message);
    this.name = 'CredentialResolutionError';
  }
}
