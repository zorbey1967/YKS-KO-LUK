import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { err: string; gen: number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: '', gen: 0 };

  static getDerivedStateFromError() {
    return { err: 'Beklenmeyen hata' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <div className="card notice" role="alert">
          <h3>Sayfa yüklenemedi</h3>
          <p className="muted">{this.state.err}. Tekrar dene veya ana sayfaya dön.</p>
          <button className="btn primary" type="button" onClick={() => this.setState((s) => ({ err: '', gen: s.gen + 1 }))}>Tekrar dene</button>
          {' '}
          <button className="btn" type="button" onClick={() => { location.hash = '#/home'; location.reload(); }}>Ana sayfaya dön</button>
        </div>
      );
    }
    return <div key={this.state.gen}>{this.props.children}</div>;
  }
}
