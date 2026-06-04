import { AgentPreviewPanel } from '@/components';
import { Button, Card } from '@/components/ui';

import { OperationsTable } from '../components/OperationsTable';
import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

export function PreviewStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { ir, curation, setCuration, manifestPreview } = useWizard();

  if (!ir) {
    return <p>No spec loaded. Go back to import.</p>;
  }

  return (
    <div className={styles.splitLayout}>
      <div className={styles.mainCol}>
        <Card>
          <h2 className={styles.heading}>Preview operations</h2>
          <p className={styles.desc}>
            {ir.operations.length} operations discovered. Include or exclude tools; use filters for large specs.
          </p>
          <OperationsTable
            operations={ir.operations}
            curation={curation}
            onCurationChange={setCuration}
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <Button onClick={onNext}>Continue to curation</Button>
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
