import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">页面不存在</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        你访问的地址可能已被移除或输入有误，可以返回概览继续查看评价动态。
      </p>
      <Link to="/app/overview" className={cn(buttonVariants(), 'mt-6')}>
        返回概览
      </Link>
    </div>
  );
}
