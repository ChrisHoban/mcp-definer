import { Link } from 'react-router-dom';

import { Alert, Button, Card } from '@/components/ui';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

export function TestStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { mcpId } = useWizard();

  return (
    <div className={styles.step}>
      <Card>
        <h2 className={styles.heading}>Test tools (optional)</h2>
        <p className={styles.desc}>
          Invoke tools against the live API before publishing. The test console is owned by the management UI (A8).
        </p>

        <Alert variant="info">
          Test console coming soon in the management view. You can invoke tools after publish from the MCP detail page.
        </Alert>

        {mcpId && (
          <p>
            <Link to={`/mcps/${mcpId}/test`}>Open test console →</Link>
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button variant="secondary" onClick={onNext}>Skip to publish</Button>
        </div>
      </Card>
    </div>
  );
}
