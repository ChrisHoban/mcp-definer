import {
  buildIndex,
  createSeededRegistryStore,
  type DiscoveryIndexV1,
} from '@mcp-definer/registry';

export interface ListOptions {
  registryUrl?: string;
  local?: boolean;
}

function printIndex(index: DiscoveryIndexV1): void {
  if (index.entries.length === 0) {
    console.log('No MCPs found in catalog.');
    return;
  }

  for (const entry of index.entries) {
    console.log(`${entry.org}/${entry.slug}@${entry.latestVersion} (${entry.channel})`);
    console.log(`  ${entry.name} — ${entry.description}`);
    console.log(`  tools: ${entry.toolCount} [${entry.toolNames.join(', ')}]`);
    if (entry.tags.length > 0) {
      console.log(`  tags: ${entry.tags.join(', ')}`);
    }
  }

  if (index.nextCursor) {
    console.log(`\nMore results available (cursor: ${index.nextCursor})`);
  }
}

export async function runList(_args: string[], options: ListOptions = {}): Promise<number> {
  if (options.local) {
    const store = await createSeededRegistryStore();
    const index = await buildIndex({ store, baseUrl: '/v1' });
    printIndex(index);
    return 0;
  }

  const baseUrl = (
    options.registryUrl ??
    process.env.MCP_DEFINER_REGISTRY_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  const url = `${baseUrl}/v1/index`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error(
      `Failed to fetch discovery index from ${url}: ${error instanceof Error ? error.message : error}`,
    );
    return 1;
  }

  if (!response.ok) {
    console.error(`Registry returned ${response.status} for ${url}`);
    return 1;
  }

  const index = (await response.json()) as DiscoveryIndexV1;
  printIndex(index);
  return 0;
}
