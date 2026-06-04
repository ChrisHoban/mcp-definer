import { secretEnvVarName } from '@mcp-definer/auth';
import type { Manifest } from '@mcp-definer/schemas';

import type { Harness, InstallSnippet, InstallSnippetTemplate, McpRef } from './types.js';
import { manifestUrl } from './urls.js';

export const INSTALL_SNIPPET_PLACEHOLDER_MANIFEST = '{{manifestUrl}}';
export const INSTALL_SNIPPET_PLACEHOLDER_SECRET = '{{secretEnvVar}}';

/** ADR-008 template stored in install_targets / returned before resolution. */
export function buildInstallSnippetTemplate(harness: Harness = 'cursor'): InstallSnippetTemplate {
  if (harness === 'cursor' || harness === 'claude-desktop') {
    return {
      command: 'npx',
      args: ['-y', '@mcp-definer/runtime', '--manifest', INSTALL_SNIPPET_PLACEHOLDER_MANIFEST],
      env: {
        [INSTALL_SNIPPET_PLACEHOLDER_SECRET]: '<set locally at install; never in registry>',
      },
    };
  }

  return {
    command: 'npx',
    args: ['-y', '@mcp-definer/runtime', '--manifest', INSTALL_SNIPPET_PLACEHOLDER_MANIFEST],
    env: {
      [INSTALL_SNIPPET_PLACEHOLDER_SECRET]: '<set locally at install; never in registry>',
    },
  };
}

export interface BuildInstallSnippetOptions {
  /** Registry base URL for manifest path resolution. Default `/v1`. */
  registryBaseUrl?: string;
  harness?: Harness;
  /** Override manifest URL (full URL). When omitted, derived from registryBaseUrl. */
  manifestUrlOverride?: string;
}

/**
 * Build a resolved harness install snippet per ADR-008.
 *
 * Stable signature for A6 and CLI consumers.
 */
export function buildInstallSnippet(
  mcp: McpRef,
  version: string,
  manifest: Manifest,
  options: BuildInstallSnippetOptions = {},
): InstallSnippet {
  const harness = options.harness ?? 'cursor';
  const template = buildInstallSnippetTemplate(harness);
  const resolvedManifestUrl =
    options.manifestUrlOverride ??
    manifestUrl(options.registryBaseUrl ?? '/v1', mcp.org, mcp.slug, version);
  const envVarName = secretEnvVarName(manifest.auth.bindingId);

  return {
    command: template.command,
    args: template.args.map((arg) =>
      arg === INSTALL_SNIPPET_PLACEHOLDER_MANIFEST ? resolvedManifestUrl : arg,
    ),
    env: {
      [envVarName]: '<user-supplied at install>',
    },
  };
}

/** Resolve a stored template with concrete manifest URL and secret env var name. */
export function resolveInstallSnippetTemplate(
  template: InstallSnippetTemplate,
  manifestUrlValue: string,
  bindingId: string,
): InstallSnippet {
  const envVarName = secretEnvVarName(bindingId);
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(template.env)) {
    const resolvedKey = key === INSTALL_SNIPPET_PLACEHOLDER_SECRET ? envVarName : key;
    env[resolvedKey] = value;
  }

  return {
    command: template.command,
    args: template.args.map((arg) =>
      arg === INSTALL_SNIPPET_PLACEHOLDER_MANIFEST ? manifestUrlValue : arg,
    ),
    env,
  };
}
