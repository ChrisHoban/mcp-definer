import { Card } from '@/components/ui';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{title}</h1>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>{description}</p>
    </Card>
  );
}
