import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const tones: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-transparent',
  primary: 'bg-accent text-accent-foreground border-transparent',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  muted: 'bg-muted text-muted-foreground border-transparent',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
