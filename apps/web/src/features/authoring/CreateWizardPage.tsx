import { WizardProvider } from './WizardContext';
import { WizardShell } from './WizardShell';

export function CreateWizardPage() {
  return (
    <WizardProvider mode="create">
      <WizardShell title="Create MCP" />
    </WizardProvider>
  );
}
