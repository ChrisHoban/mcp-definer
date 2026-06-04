/**
 * JSON-Schema-driven form renderer.
 *
 * Shared component for A7 (tool inputSchema curation) and A8 (test console).
 * Supports common JSON Schema types: string, number, integer, boolean, enum,
 * object (nested properties), and array (primitive items).
 *
 * @example
 * ```tsx
 * import { JsonSchemaForm } from '@/components';
 *
 * <JsonSchemaForm
 *   schema={tool.inputSchema}
 *   value={args}
 *   onChange={setArgs}
 * />
 * ```
 */
import { useCallback, useId } from 'react';

import { Input, Label, Select, Textarea } from '@/components/ui';

import styles from './JsonSchemaForm.module.css';

export type JsonSchema = Record<string, unknown>;

export interface JsonSchemaFormProps {
  schema: JsonSchema;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  /** Field path prefix for nested rendering */
  pathPrefix?: string;
  disabled?: boolean;
}

function schemaType(schema: JsonSchema): string {
  if (Array.isArray(schema.type)) {
    return (schema.type as string[]).find((t) => t !== 'null') ?? 'string';
  }
  return (schema.type as string) ?? 'string';
}

function getEnum(schema: JsonSchema): unknown[] | undefined {
  return schema.enum as unknown[] | undefined;
}

function fieldLabel(name: string, schema: JsonSchema): string {
  return (schema.title as string) ?? name;
}

function fieldDescription(schema: JsonSchema): string | undefined {
  return schema.description as string | undefined;
}

function isRequired(schema: JsonSchema, name: string): boolean {
  const required = schema.required as string[] | undefined;
  return required?.includes(name) ?? false;
}

function renderPrimitiveField(
  name: string,
  fieldSchema: JsonSchema,
  value: unknown,
  onFieldChange: (name: string, val: unknown) => void,
  required: boolean,
  disabled: boolean,
  id: string,
) {
  const type = schemaType(fieldSchema);
  const enumValues = getEnum(fieldSchema);
  const desc = fieldDescription(fieldSchema);

  if (enumValues) {
    return (
      <div key={name} className={styles.field}>
        <Label htmlFor={id}>
          {fieldLabel(name, fieldSchema)}
          {required && <span aria-hidden="true"> *</span>}
        </Label>
        {desc && <p className={styles.hint}>{desc}</p>}
        <Select
          id={id}
          value={String(value ?? enumValues[0] ?? '')}
          onChange={(e) => onFieldChange(name, e.target.value)}
          disabled={disabled}
          required={required}
        >
          {enumValues.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  if (type === 'boolean') {
    return (
      <div key={name} className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onFieldChange(name, e.target.checked)}
            disabled={disabled}
          />
          {fieldLabel(name, fieldSchema)}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {desc && <p className={styles.hint}>{desc}</p>}
      </div>
    );
  }

  if (type === 'integer' || type === 'number') {
    return (
      <div key={name} className={styles.field}>
        <Label htmlFor={id}>
          {fieldLabel(name, fieldSchema)}
          {required && <span aria-hidden="true"> *</span>}
        </Label>
        {desc && <p className={styles.hint}>{desc}</p>}
        <Input
          id={id}
          type="number"
          step={type === 'integer' ? 1 : 'any'}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            onFieldChange(name, raw === '' ? undefined : Number(raw));
          }}
          disabled={disabled}
          required={required}
        />
      </div>
    );
  }

  const isLongText = (fieldSchema.maxLength as number | undefined) !== undefined &&
    (fieldSchema.maxLength as number) > 200;

  return (
    <div key={name} className={styles.field}>
      <Label htmlFor={id}>
        {fieldLabel(name, fieldSchema)}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {desc && <p className={styles.hint}>{desc}</p>}
      {isLongText ? (
        <Textarea
          id={id}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onFieldChange(name, e.target.value)}
          disabled={disabled}
          required={required}
        />
      ) : (
        <Input
          id={id}
          type="text"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onFieldChange(name, e.target.value)}
          disabled={disabled}
          required={required}
        />
      )}
    </div>
  );
}

export function JsonSchemaForm({
  schema,
  value,
  onChange,
  pathPrefix = '',
  disabled = false,
}: JsonSchemaFormProps) {
  const baseId = useId();
  const type = schemaType(schema);

  const onFieldChange = useCallback(
    (name: string, val: unknown) => {
      onChange({ ...value, [name]: val });
    },
    [onChange, value],
  );

  if (type === 'object' || schema.properties) {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    const keys = Object.keys(properties);

    if (keys.length === 0) {
      return <p className={styles.empty}>No input parameters defined.</p>;
    }

    return (
      <div className={styles.form}>
        {keys.map((name) => {
          const fieldSchema = properties[name]!;
          const fieldId = `${baseId}-${pathPrefix}${name}`;
          const fieldType = schemaType(fieldSchema);

          if (fieldType === 'object' && fieldSchema.properties) {
            const nestedValue = (value[name] as Record<string, unknown>) ?? {};
            return (
              <fieldset key={name} className={styles.nested}>
                <legend>{fieldLabel(name, fieldSchema)}</legend>
                <JsonSchemaForm
                  schema={fieldSchema}
                  value={nestedValue}
                  onChange={(nested) => onFieldChange(name, nested)}
                  pathPrefix={`${pathPrefix}${name}.`}
                  disabled={disabled}
                />
              </fieldset>
            );
          }

          return renderPrimitiveField(
            name,
            fieldSchema,
            value[name],
            onFieldChange,
            isRequired(schema, name),
            disabled,
            fieldId,
          );
        })}
      </div>
    );
  }

  return <p className={styles.empty}>Unsupported schema type: {type}</p>;
}

export default JsonSchemaForm;
