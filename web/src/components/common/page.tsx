import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: Array<{ label: string; to?: string }>;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {breadcrumb?.length ? (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
              {item.to ? (
                <Link to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('card-surface', className)}>
      {title || action ? (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/60 px-4 py-3 text-sm text-red-700">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry ? (
          <button onClick={onRetry} className="text-xs font-medium underline underline-offset-2">
            重试
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
