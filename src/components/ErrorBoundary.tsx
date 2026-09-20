import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { err: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: '' };

  static getDerivedStateFromError(error: Error) {
    return { err: error.message || 'Beklenmeyen hata' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card notice" role="alert">
        <h3>Sayfa yüklenemedi</h3>
        <p>{this.state.err}</p>
        <button className="btn primary" type="button" onClick={() => this.setState({ err: '' })}>Tekrar dene</button>
        {' '}
        <button className="btn" type="button" onClick={() => { location.hash = '#/home'; location.reload(); }}>Ana sayfaya dön</button>
      </div>
    );
  }
}
