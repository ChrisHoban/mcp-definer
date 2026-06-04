import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Alert, Button, Card, Input, Label, Spinner, Textarea } from '@/components/ui';
import { ApiError, api } from '@/lib/api-client';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

function inferFilename(text: string, current: string): string {
  const trimmed = text.trim().replace(/^```(?:yaml|yml|json|openapi)?\s*\n/i, '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'openapi.json';
  }
  if (/^(openapi|swagger):/m.test(trimmed)) {
    return 'openapi.yaml';
  }
  return current.endsWith('.json') || current.endsWith('.yaml') || current.endsWith('.yml')
    ? current
    : 'openapi.yaml';
}

export function ImportStep({ onNext }: { onNext: () => void }) {
  const { setIr, setSpecText, setParseWarnings, meta, setMeta, mode } = useWizard();
  const [content, setContent] = useState('');
  const [specUrl, setSpecUrl] = useState('');
  const [filename, setFilename] = useState('openapi.yaml');
  const [error, setError] = useState<string | null>(null);

  const parseMutation = useMutation({
    mutationFn: () =>
      specUrl.trim()
        ? api.parseSpec({ url: specUrl.trim() })
        : api.parseSpec({ content, filename }),
    onSuccess: (data) => {
      setIr(data.ir);
      setSpecText(data.specText);
      setParseWarnings(data.warnings);
      if (mode === 'create' && !meta.slug && data.ir.source.title) {
        const slug = data.ir.source.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        setMeta((m) => ({
          ...m,
          slug: slug || m.slug,
          name: data.ir.source.title ?? m.name,
        }));
      }
      setError(null);
      onNext();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to parse spec');
    },
  });

  function handleFileUpload(file: File) {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  return (
    <div className={styles.step}>
      <Card>
        <h2 className={styles.heading}>Import OpenAPI spec</h2>
        <p className={styles.desc}>
          Upload a file, paste YAML/JSON, or import from a URL (server must allow the host via
          SPEC_FETCH_ALLOWLIST).
        </p>

        {mode === 'create' && (
          <div className={styles.metaGrid}>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={meta.slug}
                onChange={(e) => setMeta((m) => ({ ...m, slug: e.target.value }))}
                placeholder="petstore"
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={meta.name}
                onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
                placeholder="Pet Store API"
              />
            </div>
          </div>
        )}

        <div className={styles.field}>
          <Label htmlFor="file">Upload file</Label>
          <Input
            id="file"
            type="file"
            accept=".yaml,.yml,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </div>

        <div className={styles.field}>
          <Label htmlFor="specUrl">Or remote URL</Label>
          <Input
            id="specUrl"
            type="url"
            value={specUrl}
            onChange={(e) => setSpecUrl(e.target.value)}
            placeholder="https://example.com/openapi.yaml"
          />
        </div>

        <div className={styles.field}>
          <Label htmlFor="content">Or paste spec</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => {
              const next = e.target.value;
              setContent(next);
              if (next.trim()) {
                setFilename((prev) => inferFilename(next, prev));
              }
            }}
            placeholder="openapi: 3.0.0..."
            rows={12}
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className={styles.actions}>
          <Button
            onClick={() => parseMutation.mutate()}
            disabled={
              (!content.trim() && !specUrl.trim()) ||
              parseMutation.isPending ||
              (mode === 'create' && !meta.slug.trim())
            }
          >
            {parseMutation.isPending ? <Spinner /> : null}
            Parse & continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
