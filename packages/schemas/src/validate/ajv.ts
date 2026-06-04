import { createRequire } from 'node:module';

import type { ErrorObject, ValidateFunction } from 'ajv';

import irSchema from '../schemas/ir.schema.json' with { type: 'json' };
import manifestSchema from '../schemas/manifest.schema.json' with { type: 'json' };
import curationProfileSchema from '../schemas/curation-profile.schema.json' with {
  type: 'json',
};

const require = createRequire(import.meta.url);

// CJS interop for NodeNext ESM package
const Ajv2020 = require('ajv/dist/2020').default as new (opts?: object) => {
  compile: (schema: object) => ValidateFunction;
  getSchema: (key: string) => ValidateFunction | undefined;
  addSchema: (schema: object) => void;
  errors: ErrorObject[] | null | undefined;
};

const addFormats = require('ajv-formats') as (ajv: InstanceType<typeof Ajv2020>) => void;

type AjvInstance = InstanceType<typeof Ajv2020>;

let ajvInstance: AjvInstance | undefined;

export function getAjv(): AjvInstance {
  if (!ajvInstance) {
    ajvInstance = new Ajv2020({
      allErrors: true,
      strict: false,
      validateSchema: false,
    });
    addFormats(ajvInstance);
    ajvInstance.addSchema(irSchema);
    ajvInstance.addSchema(manifestSchema);
    ajvInstance.addSchema(curationProfileSchema);
  }
  return ajvInstance;
}

export { irSchema, manifestSchema, curationProfileSchema };
