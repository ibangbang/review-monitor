import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null; info: string | null };

/** 兜底错误边界：渲染期异常显示可读信息与重试按钮，避免整页白屏。 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? null });
    console.error('[ReviewMonitor Dash] 渲染异常', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            border: '1px solid var(--color-border-2)',
            borderRadius: 8,
            padding: 20,
            background: 'var(--color-bg-2)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 16 }}>页面渲染出错</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-3)' }}>
            这是前端运行期异常，不是接口问题。完整堆栈见浏览器控制台。
          </p>
          <pre
            style={{
              marginTop: 12,
              maxHeight: 220,
              overflow: 'auto',
              fontSize: 11,
              lineHeight: 1.6,
              padding: 12,
              borderRadius: 6,
              background: 'var(--color-fill-2)',
            }}
          >
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.reload()} style={{ padding: '6px 12px', fontSize: 12 }}>
              重新加载
            </button>
            <button
              onClick={() => this.setState({ error: null, info: null })}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              重试渲染
            </button>
          </div>
        </div>
      </div>
    );
  }
}
