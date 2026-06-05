import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CurationProfile, IntermediateRepresentation, Manifest } from '@mcp-definer/schemas';

import { buildManifestFromIr, createEmptyCuration } from '@/lib/curation';

import type {
  AuthConfigState,
  McpMeta,
  PublishState,
  ValidationState,
  WizardStepId,
} from './wizard-types';

export interface WizardContextValue {
  mode: 'create' | 'edit';
  step: WizardStepId;
  setStep: (step: WizardStepId) => void;
  mcpId: string | null;
  setMcpId: (id: string) => void;
  version: string;
  setVersion: (ver: string) => void;
  isPublished: boolean;
  setIsPublished: (v: boolean) => void;
  ir: IntermediateRepresentation | null;
  setIr: (ir: IntermediateRepresentation | null) => void;
  specText: string;
  setSpecText: (text: string) => void;
  parseWarnings: { code: string; message: string }[];
  setParseWarnings: (w: { code: string; message: string }[]) => void;
  curation: CurationProfile;
  setCuration: (c: CurationProfile | ((prev: CurationProfile) => CurationProfile)) => void;
  meta: McpMeta;
  setMeta: (m: McpMeta | ((prev: McpMeta) => McpMeta)) => void;
  manifestPreview: Manifest | null;
  auth: AuthConfigState;
  setAuth: (a: AuthConfigState | ((prev: AuthConfigState) => AuthConfigState)) => void;
  validation: ValidationState;
  setValidation: (v: ValidationState | ((prev: ValidationState) => ValidationState)) => void;
  publish: PublishState;
  setPublish: (p: PublishState | ((prev: PublishState) => PublishState)) => void;
  clearSecretDraft: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

const defaultMeta: McpMeta = {
  slug: '',
  name: '',
  description: '',
  visibility: 'private',
};

const defaultAuth: AuthConfigState = {
  authType: 'apiKey',
  config: { in: 'header', name: 'api_key' },
  secretDraft: '',
  bindingId: null,
  hasSecret: false,
  secretRef: null,
};

const defaultValidation: ValidationState = {
  valid: null,
  errors: [],
  warnings: [],
  lastCheckedAt: null,
};

const defaultPublish: PublishState = {
  semver: '0.1.0',
  channel: 'stable',
  changelog: '',
  published: false,
  publishedAt: null,
};

export function WizardProvider({
  children,
  mode,
  initialMcpId,
  initialVersion,
  initialPublished = false,
}: {
  children: ReactNode;
  mode: 'create' | 'edit';
  initialMcpId?: string;
  initialVersion?: string;
  initialPublished?: boolean;
}) {
  const [step, setStep] = useState<WizardStepId>('import');
  const [mcpId, setMcpId] = useState<string | null>(initialMcpId ?? null);
  const [version, setVersion] = useState(initialVersion ?? '0.1.0');
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [ir, setIr] = useState<IntermediateRepresentation | null>(null);
  const [specText, setSpecText] = useState('');
  const [parseWarnings, setParseWarnings] = useState<{ code: string; message: string }[]>([]);
  const [curation, setCuration] = useState<CurationProfile>(createEmptyCuration());
  const [meta, setMeta] = useState<McpMeta>(defaultMeta);
  const [auth, setAuth] = useState<AuthConfigState>(defaultAuth);
  const [validation, setValidation] = useState<ValidationState>(defaultValidation);
  const [publish, setPublish] = useState<PublishState>(defaultPublish);

  const manifestPreview = useMemo(() => {
    if (!ir || !meta.slug) return null;
    try {
      return buildManifestFromIr(ir, curation, {
        slug: meta.slug,
        name: meta.name || meta.slug,
        description: meta.description,
      });
    } catch {
      return null;
    }
  }, [ir, curation, meta]);

  const clearSecretDraft = useCallback(() => {
    setAuth((prev) => ({ ...prev, secretDraft: '' }));
  }, []);

  const value = useMemo(
    () => ({
      mode,
      step,
      setStep,
      mcpId,
      setMcpId,
      version,
      setVersion,
      isPublished,
      setIsPublished,
      ir,
      setIr,
      specText,
      setSpecText,
      parseWarnings,
      setParseWarnings,
      curation,
      setCuration,
      meta,
      setMeta,
      manifestPreview,
      auth,
      setAuth,
      validation,
      setValidation,
      publish,
      setPublish,
      clearSecretDraft,
    }),
    [
      mode,
      step,
      mcpId,
      version,
      isPublished,
      ir,
      specText,
      parseWarnings,
      curation,
      meta,
      manifestPreview,
      auth,
      validation,
      publish,
      clearSecretDraft,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
