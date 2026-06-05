# Shared Components (A7 → A8)

Components exported from `@/components` (or `apps/web/src/components/index.ts`) for reuse across authoring (A7) and management (A8).

## JsonSchemaForm

JSON-Schema-driven form renderer for tool `inputSchema` editing and the test console.

```tsx
import { JsonSchemaForm } from '@/components';

<JsonSchemaForm schema={tool.inputSchema} value={formValues} onChange={setFormValues} />;
```

**Supported types:** `string`, `number`, `integer`, `boolean`, `enum`, nested `object`, required fields.

## API Client

```tsx
import { api, getStoredApiKey, setStoredApiKey } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
```

Phase 1 auth: `X-API-Key` header from `localStorage` or `VITE_API_KEY` env.

## Auth Context

```tsx
import { AuthProvider, useAuth } from '@/context/AuthContext';

const { can, role, setApiKey } = useAuth();
if (can('mcp:publish')) {
  /* show publish button */
}
```

Dev role is stored in `localStorage` key `mcp-definer-role` (default `owner`).

## Folder conventions

- `features/authoring/` — A7 wizard routes
- `features/management/` — A8 catalog, detail, test console, registry
