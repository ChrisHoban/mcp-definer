import type { ErrorObject } from 'ajv';

import type { CurationProfile } from '../types/curation-profile.js';
import type { ValidateCurationProfileResult, ValidationIssue } from '../types/validation.js';
import { getAjv, curationProfileSchema } from './ajv.js';

function ajvErrorsToIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) {
    return [];
  }

  return errors.map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? 'Validation failed',
    code: error.keyword,
  }));
}

export function validateCurationProfile(input: unknown): ValidateCurationProfileResult {
  const ajv = getAjv();
  const validate = ajv.getSchema(curationProfileSchema.$id!) ?? ajv.compile(curationProfileSchema);
  const valid = validate(input);

  if (!valid) {
    return {
      valid: false,
      errors: ajvErrorsToIssues(validate.errors),
    };
  }

  return { valid: true };
}

export function assertCurationProfile(input: unknown): CurationProfile {
  const result = validateCurationProfile(input);
  if (!result.valid) {
    const message =
      result.errors?.map((e) => `${e.path}: ${e.message}`).join('; ') ?? 'Invalid curation profile';
    throw new Error(message);
  }
  return input as CurationProfile;
}
