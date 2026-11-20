import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${rating} 星`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          width={size}
          height={size}
          className={cn(
            value <= rating ? 'fill-star text-star' : 'fill-transparent text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}
