import { useId, type ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const headingId = useId();
  return (
    <section className="empty-state" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
