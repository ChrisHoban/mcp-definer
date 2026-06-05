import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui';

import { ApiError, api } from '@/lib/api-client';

import { buildManifestFromIr, ensureCurationVersion } from '@/lib/curation';

import { WizardStepper } from './components/WizardStepper';

import { AuthStep } from './steps/AuthStep';

import { CurateStep } from './steps/CurateStep';

import { ImportStep } from './steps/ImportStep';

import { PreviewStep } from './steps/PreviewStep';

import { PublishStep } from './steps/PublishStep';

import { TestStep } from './steps/TestStep';

import { ValidateStep } from './steps/ValidateStep';

import { useWizard } from './WizardContext';

import { WIZARD_STEPS, type WizardStepId } from './wizard-types';

import styles from './WizardShell.module.css';

function stepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((s) => s.id === id);
}

function buildAuthorState(wizard: ReturnType<typeof useWizard>) {
  return {
    wizardStep: wizard.step,

    parseWarnings: wizard.parseWarnings,
  };
}

export function WizardShell({ title }: { title: string }) {
  const wizard = useWizard();

  const [saving, setSaving] = useState(false);

  const [conflictError, setConflictError] = useState<string | null>(null);

  const stepPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (step: WizardStepId) => wizard.setStep(step),

    [wizard],
  );

  const goNext = useCallback(() => {
    const idx = stepIndex(wizard.step);

    if (idx < WIZARD_STEPS.length - 1) {
      wizard.setStep(WIZARD_STEPS[idx + 1]!.id);
    }
  }, [wizard]);

  const goBack = useCallback(() => {
    const idx = stepIndex(wizard.step);

    if (idx > 0) {
      wizard.setStep(WIZARD_STEPS[idx - 1]!.id);
    }
  }, [wizard]);

  const saveDraft = useCallback(async () => {
    if (!wizard.ir || !wizard.meta.slug) {
      throw new Error('Missing spec or MCP metadata');
    }

    setSaving(true);

    setConflictError(null);

    const curation = ensureCurationVersion(wizard.curation);

    const manifest = buildManifestFromIr(wizard.ir, curation, {
      slug: wizard.meta.slug,

      name: wizard.meta.name || wizard.meta.slug,

      description: wizard.meta.description,
    });

    const authorState = buildAuthorState(wizard);

    try {
      if (wizard.mode === 'create' && !wizard.mcpId) {
        const created = await api.createMcp({
          slug: wizard.meta.slug,

          name: wizard.meta.name || wizard.meta.slug,

          description: wizard.meta.description,

          visibility: wizard.meta.visibility,

          ir: wizard.ir,

          curation,

          version: wizard.version,

          specText: wizard.specText,

          authorState,
        });

        wizard.setMcpId(created.id);

        wizard.setVersion(created.draftVersion);

        wizard.setPublish((p) => ({ ...p, semver: created.draftVersion }));
      } else if (wizard.mcpId) {
        await api.patchVersion(wizard.mcpId, wizard.version, {
          manifest,

          curation,

          authorState,

          specText: wizard.specText,

          specType: wizard.ir.source.type,

          specHash: wizard.ir.source.hash,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictError(
          'This version is published and immutable. Create a new version to continue editing.',
        );
      }

      throw err;
    } finally {
      setSaving(false);
    }
  }, [wizard]);

  useEffect(() => {
    if (!wizard.mcpId || wizard.isPublished) {
      return;
    }

    if (stepPersistTimer.current) {
      clearTimeout(stepPersistTimer.current);
    }

    stepPersistTimer.current = setTimeout(() => {
      void api
        .patchVersion(wizard.mcpId!, wizard.version, {
          authorState: buildAuthorState(wizard),
        })
        .catch(() => {
          /* best-effort step persistence */
        });
    }, 400);

    return () => {
      if (stepPersistTimer.current) {
        clearTimeout(stepPersistTimer.current);
      }
    };
  }, [wizard.step, wizard.mcpId, wizard.version, wizard.isPublished, wizard.parseWarnings]);

  const maxReachable = wizard.ir ? WIZARD_STEPS.length - 1 : 0;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>

        {wizard.mcpId && (
          <span className={styles.meta}>
            {wizard.mcpId} · v{wizard.version}
            {wizard.isPublished && ' (published)'}
          </span>
        )}
      </header>

      <WizardStepper current={wizard.step} onStepClick={goTo} maxReachable={maxReachable} />

      {conflictError && (
        <Alert variant="danger">
          {conflictError}

          {wizard.mcpId && (
            <p>
              <a href={`/mcps/${wizard.mcpId}`}>Create new version from MCP detail →</a>
            </p>
          )}
        </Alert>
      )}

      {wizard.step === 'import' && <ImportStep onNext={goNext} />}

      {wizard.step === 'preview' && <PreviewStep onNext={goNext} onBack={goBack} />}

      {wizard.step === 'curate' && (
        <CurateStep onNext={goNext} onBack={goBack} onSaveDraft={saveDraft} saving={saving} />
      )}

      {wizard.step === 'auth' && <AuthStep onNext={goNext} onBack={goBack} />}

      {wizard.step === 'validate' && <ValidateStep onNext={goNext} onBack={goBack} />}

      {wizard.step === 'test' && <TestStep onNext={goNext} onBack={goBack} />}

      {wizard.step === 'publish' && <PublishStep onBack={goBack} />}
    </div>
  );
}
