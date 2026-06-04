import { WIZARD_STEPS, type WizardStepId } from '../wizard-types';

import styles from './WizardStepper.module.css';

interface WizardStepperProps {
  current: WizardStepId;
  onStepClick?: (step: WizardStepId) => void;
  maxReachable?: number;
}

export function WizardStepper({ current, onStepClick, maxReachable = WIZARD_STEPS.length - 1 }: WizardStepperProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current);

  return (
    <nav className={styles.stepper} aria-label="Wizard progress">
      <ol className={styles.list}>
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === current;
          const isComplete = index < currentIndex;
          const isReachable = index <= maxReachable;
          const canClick = onStepClick && isReachable && !isActive;

          return (
            <li key={step.id} className={styles.item}>
              <button
                type="button"
                className={`${styles.step} ${isActive ? styles.active : ''} ${isComplete ? styles.complete : ''}`}
                onClick={canClick ? () => onStepClick!(step.id) : undefined}
                disabled={!canClick}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.number}>{index + 1}</span>
                <span className={styles.label}>{step.label}</span>
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <span className={`${styles.connector} ${index < currentIndex ? styles.connectorComplete : ''}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
