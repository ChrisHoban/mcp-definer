import type { ResolvedCredential } from '@mcp-definer/auth';
import { redactText } from '@mcp-definer/request-pipeline';

export interface RuntimeLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

function write(level: 'INFO' | 'ERROR', message: string, fields?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ...fields,
  };
  console.error(JSON.stringify(payload));
}

export function createLogger(credential?: ResolvedCredential): RuntimeLogger {
  const redact = (message: string) => (credential ? redactText(message, credential) : message);

  return {
    info(message, fields) {
      write('INFO', redact(message), fields);
    },
    error(message, fields) {
      write('ERROR', redact(message), fields);
    },
  };
}
