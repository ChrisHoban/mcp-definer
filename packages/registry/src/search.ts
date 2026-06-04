import type {
  DiscoveryIndexEntry,
  RegistryContext,
  SearchCatalogParams,
  SearchCatalogResult,
} from './types.js';
import { buildIndex } from './build-index.js';
import { installPath, manifestPath } from './urls.js';

function matchesQuery(entry: DiscoveryIndexEntry, query: string): boolean {
  const q = query.toLowerCase();
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.slug.toLowerCase().includes(q) ||
    entry.org.toLowerCase().includes(q) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    entry.toolNames.some((name) => name.toLowerCase().includes(q))
  );
}

/** Search published catalog entries. */
export async function searchCatalog(
  ctx: RegistryContext,
  params: SearchCatalogParams = {},
): Promise<SearchCatalogResult> {
  const index = await buildIndex(ctx, { generatedAt: new Date().toISOString() });
  const baseUrl = ctx.baseUrl ?? '/v1';
  let entries = index.entries;

  if (params.visibility) {
    entries = entries.filter((e) => e.visibility === params.visibility);
  }
  if (params.channel && params.channel !== 'draft') {
    entries = entries.filter((e) => e.channel === params.channel);
  }
  if (params.tags?.length) {
    entries = entries.filter((e) => params.tags!.every((tag) => e.tags.includes(tag)));
  }
  if (params.capability) {
    entries = entries.filter((e) => e.toolNames.includes(params.capability!));
  }
  if (params.query) {
    entries = entries.filter((e) => matchesQuery(e, params.query!));
  }

  const limit = Math.min(params.limit ?? 50, 100);
  let start = 0;
  if (params.cursor) {
    const idx = entries.findIndex((e) => `${e.org}/${e.slug}` === params.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }

  const page = entries.slice(start, start + limit).map((entry) => ({
    ...entry,
    installUrl: entry.installUrl.startsWith(baseUrl)
      ? entry.installUrl
      : `${baseUrl}${installPath(entry.org, entry.slug)}`,
    manifestUrl: entry.manifestUrl.startsWith(baseUrl)
      ? entry.manifestUrl
      : `${baseUrl}${manifestPath(entry.org, entry.slug, entry.latestVersion)}`,
  }));

  const nextCursor =
    start + limit < entries.length
      ? `${page[page.length - 1]!.org}/${page[page.length - 1]!.slug}`
      : null;

  return { entries: page, nextCursor };
}
