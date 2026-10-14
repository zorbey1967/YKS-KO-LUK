import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Kök öğe yok');

window.setTimeout(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Öğrenci E-Koçluk';
  const p = document.createElement('p');
  p.append('Sayfa yüklenemedi. ');
  const a = document.createElement('a');
  a.href = '/';
  a.textContent = 'Yenile';
  p.append(a, '.');
  boot.append(h, p);
}, 20000);

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
document.getElementById('boot')?.remove();
