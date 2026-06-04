import type { ErrorObject } from 'ajv';

import type { IntermediateRepresentation } from '../types/ir.js';
import type { ValidateIrResult, ValidationIssue } from '../types/validation.js';
import { getAjv, irSchema } from './ajv.js';

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

export function validateIr(input: unknown): ValidateIrResult {
  const ajv = getAjv();
  const validate = ajv.getSchema(irSchema.$id!) ?? ajv.compile(irSchema);
  const valid = validate(input);

  if (!valid) {
    return {
      valid: false,
      errors: ajvErrorsToIssues(validate.errors),
    };
  }

  return { valid: true };
}

export function assertIr(input: unknown): IntermediateRepresentation {
  const result = validateIr(input);
  if (!result.valid) {
    const message = result.errors?.map((e) => `${e.path}: ${e.message}`).join('; ') ?? 'Invalid IR';
    throw new Error(message);
  }
  return input as IntermediateRepresentation;
}
