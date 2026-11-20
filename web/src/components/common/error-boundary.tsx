import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null; info: string | null };

/**
 * 兜底错误边界：任何渲染期异常都会显示可读信息与重试按钮，
 * 而不是留下整页白屏。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? null });
    console.error('[ReviewMonitor] 渲染异常', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-card">
          <h1 className="text-base font-semibold">页面渲染出错</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            这是前端运行期异常，不是接口问题。可以在浏览器控制台看到完整堆栈。
          </p>
          <pre className="mt-4 max-h-52 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>
          <div className="mt-4 flex gap-3 text-xs">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
            >
              重新加载
            </button>
            <button
              onClick={() => {
                this.setState({ error: null, info: null });
              }}
              className="rounded-md border px-3 py-1.5 font-medium"
            >
              重试渲染
            </button>
          </div>
        </div>
      </div>
    );
  }
}
