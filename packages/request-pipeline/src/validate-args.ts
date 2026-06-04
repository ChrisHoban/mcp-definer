import { createRequire } from 'node:module';

import type { ErrorObject, ValidateFunction } from 'ajv';
import type { JsonSchema } from '@mcp-definer/schemas';

import { ToolValidationError } from './errors.js';

const require = createRequire(import.meta.url);

type AjvInstance = {
  compile: (schema: object) => ValidateFunction;
};

const Ajv2020 = require('ajv/dist/2020').default as new (opts?: object) => AjvInstance;
const addFormats = require('ajv-formats') as (ajv: AjvInstance) => void;

let ajvInstance: AjvInstance | undefined;

function getToolAjv(): AjvInstance {
  if (!ajvInstance) {
    ajvInstance = new Ajv2020({
      allErrors: true,
      strict: false,
      validateSchema: false,
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

export function validateToolArgs(inputSchema: JsonSchema, args: unknown): void {
  const ajv = getToolAjv();
  const validate = ajv.compile(inputSchema);
  const valid = validate(args);

  if (!valid) {
    const issues =
      validate.errors?.map((error: ErrorObject) => {
        const path = error.instancePath || '/';
        return `${path}: ${error.message ?? 'invalid'}`;
      }) ?? ['invalid arguments'];

    throw new ToolValidationError('Tool arguments failed validation', issues);
  }
}
