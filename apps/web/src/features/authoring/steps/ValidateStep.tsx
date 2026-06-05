import { useMutation } from '@tanstack/react-query';

import { AgentPreviewPanel } from '@/components';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { ApiError, api } from '@/lib/api-client';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

export function ValidateStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { mcpId, version, validation, setValidation, manifestPreview } = useWizard();

  const validateMutation = useMutation({
    mutationFn: () => api.validateVersion(mcpId!, version),
    onSuccess: (data) => {
      setValidation({
        valid: data.valid,
        errors: data.errors,
        warnings: data.warnings,
        lastCheckedAt: new Date().toISOString(),
      });
    },
  });

  const canProceed = validation.valid === true;

  if (!mcpId) {
    return (
      <Card>
        <Alert variant="warning">Complete previous steps first.</Alert>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </Card>
    );
  }

  return (
    <div className={styles.splitLayout}>
      <div className={styles.mainCol}>
        <Card>
          <h2 className={styles.heading}>Validate manifest</h2>
          <p className={styles.desc}>
            Run conformance checks before publishing. Errors block publish; warnings are advisory.
          </p>

          <div className={styles.actions} style={{ marginBottom: '1rem' }}>
            <Button onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
              {validateMutation.isPending ? <Spinner /> : null}
              Run validation
            </Button>
            {validation.lastCheckedAt && (
              <Badge variant={validation.valid ? 'success' : 'danger'}>
                {validation.valid ? 'Valid' : 'Invalid'}
              </Badge>
            )}
          </div>

          {validateMutation.error && (
            <Alert variant="danger">
              {validateMutation.error instanceof ApiError
                ? validateMutation.error.message
                : 'Validation request failed'}
            </Alert>
          )}

          {validation.errors.length > 0 && (
            <div className={styles.issueList}>
              <h3 className={styles.issueHeading}>Errors</h3>
              {validation.errors.map((err, i) => (
                <Alert key={i} variant="danger">
                  {err.path && <code>{err.path}: </code>}
                  {err.message}
                </Alert>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className={styles.issueList}>
              <h3 className={styles.issueHeading}>Warnings</h3>
              {validation.warnings.map((warn, i) => (
                <Alert key={i} variant="warning">
                  {warn.path && <code>{warn.path}: </code>}
                  {warn.message}
                </Alert>
              ))}
            </div>
          )}

          {validation.valid && validation.lastCheckedAt && (
            <Alert variant="success">Manifest is valid and ready to publish.</Alert>
          )}

          <div className={styles.actions}>
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onNext} disabled={!canProceed}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
      {manifestPreview && (
        <aside className={styles.previewCol}>
          <AgentPreviewPanel tools={manifestPreview.tools} />
        </aside>
      )}
    </div>
  );
}
