import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, Spinner } from '@/components/ui';
import { ApiError, api } from '@/lib/api-client';
import { createEmptyCuration } from '@/lib/curation';

import { WizardProvider, useWizard } from './WizardContext';
import { WizardShell } from './WizardShell';
import type { WizardStepId } from './wizard-types';

function isWizardStep(value: string | undefined): value is WizardStepId {
  return (
    value === 'import' ||
    value === 'preview' ||
    value === 'curate' ||
    value === 'auth' ||
    value === 'validate' ||
    value === 'test' ||
    value === 'publish'
  );
}

function EditWizardLoader() {
  const { id, ver } = useParams<{ id: string; ver: string }>();
  const wizard = useWizard();
  const initialized = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const versionQuery = useQuery({
    queryKey: ['version', id, ver],
    queryFn: () => api.getVersion(id!, ver!),
    enabled: Boolean(id && ver),
  });

  useEffect(() => {
    if (!versionQuery.data || !id || initialized.current) return;

    let cancelled = false;

    async function hydrate() {
      const data = versionQuery.data!;
      initialized.current = true;

      wizard.setMcpId(id!);
      wizard.setVersion(data.version);
      wizard.setIsPublished(Boolean(data.publishedAt));
      wizard.setMeta((m) => ({
        ...m,
        slug: data.manifest.name,
        name: data.manifest.displayName ?? data.manifest.name,
        description: data.manifest.description ?? '',
      }));

      if (data.curation) {
        wizard.setCuration(data.curation);
      } else {
        wizard.setCuration(createEmptyCuration());
      }

      if (data.authorState?.parseWarnings) {
        wizard.setParseWarnings(data.authorState.parseWarnings);
      }

      const step = data.authorState?.wizardStep;
      if (isWizardStep(step)) {
        wizard.setStep(step);
      } else {
        wizard.setStep('curate');
      }

      if (data.specText) {
        try {
          const parsed = await api.parseSpec({ content: data.specText, filename: 'openapi.yaml' });
          if (cancelled) return;
          wizard.setSpecText(parsed.specText);
          wizard.setIr(parsed.ir);
          if (!data.authorState?.parseWarnings?.length && parsed.warnings.length) {
            wizard.setParseWarnings(parsed.warnings);
          }
        } catch (err) {
          if (cancelled) return;
          setLoadError(err instanceof ApiError ? err.message : 'Failed to restore OpenAPI spec');
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [versionQuery.data, id, wizard]);

  if (versionQuery.isLoading) {
    return <Spinner />;
  }

  if (versionQuery.error) {
    const msg =
      versionQuery.error instanceof ApiError
        ? versionQuery.error.message
        : 'Failed to load version';
    return <Alert variant="danger">{msg}</Alert>;
  }

  if (loadError) {
    return <Alert variant="danger">{loadError}</Alert>;
  }

  return <WizardShell title={`Edit v${ver}`} />;
}

export function EditWizardPage() {
  const { id, ver } = useParams<{ id: string; ver: string }>();

  if (!id || !ver) {
    return <Alert variant="danger">Missing MCP id or version.</Alert>;
  }

  return (
    <WizardProvider mode="edit" initialMcpId={id} initialVersion={ver}>
      <EditWizardLoader />
    </WizardProvider>
  );
}
