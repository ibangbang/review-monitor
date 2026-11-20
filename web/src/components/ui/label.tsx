import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, children, htmlFor, hint }: { className?: string; children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 flex items-baseline justify-between text-sm font-medium', className)}>
      <span>{children}</span>
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}
