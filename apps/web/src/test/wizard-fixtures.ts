import type { IntermediateRepresentation } from '@mcp-definer/schemas';

export const mockPetIr: IntermediateRepresentation = {
  irVersion: '1.0',
  source: {
    type: 'swagger2',
    hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    title: 'Petstore API',
  },
  servers: [{ url: 'https://petstore.swagger.io/v2' }],
  operations: [
    {
      id: 'listPets',
      method: 'GET',
      path: '/pets',
      summary: 'List all pets',
      parameters: [],
      responses: [{ status: '200' }],
    },
    {
      id: 'getPet',
      method: 'GET',
      path: '/pets/{id}',
      summary: 'Get pet by ID',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      responses: [{ status: '200' }],
    },
  ],
  securitySchemes: {},
};

export const defaultWizardMeta = {
  slug: 'petstore',
  name: 'Petstore',
  description: 'Test API',
  visibility: 'private' as const,
};
