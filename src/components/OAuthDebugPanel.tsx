import { useEffect, useState } from 'react';
import { formatOAuthDebugPanel, OAUTH_DEBUG_EVENT, readOAuthDebug } from '../lib/oauthDebug';
import { urlHasOAuthCallback } from '../lib/authCallback';

export function OAuthDebugPanel() {
  const [text, setText] = useState('');
  useEffect(() => {
    const sync = () => {
      const snap = readOAuthDebug();
      const fromUrl = typeof location !== 'undefined' && urlHasOAuthCallback(location.search, location.hash);
      if (!snap.step && !fromUrl) {
        setText('');
        return;
      }
      setText(formatOAuthDebugPanel(snap));
    };
    sync();
    window.addEventListener(OAUTH_DEBUG_EVENT, sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener(OAUTH_DEBUG_EVENT, sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  if (!text) return null;
  return (
    <pre
      role="status"
      aria-label="OAUTH DEBUG"
      style={{
        margin: '12px 16px',
        padding: 12,
        background: '#111827',
        color: '#fde68a',
        fontSize: 12,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        borderRadius: 8,
        overflow: 'auto',
      }}
    >
      {text}
    </pre>
  );
}
