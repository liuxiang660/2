import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: ''
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '页面发生未知错误'
    };
  }

  componentDidCatch(error: Error) {
    console.error('Admin UI runtime error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 760, margin: '8vh auto', padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>管理界面加载失败</h2>
          <p>页面已捕获运行时异常，避免白屏。</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12
            }}
          >
            {this.state.message}
          </pre>
          <button onClick={() => window.location.reload()}>刷新重试</button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
