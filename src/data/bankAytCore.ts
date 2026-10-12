import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** Özgün AYT matematik maddeleri. Şablon kopyası değil. */
export const AYT_CORE_BANK: Record<string, BankQuestion[]> = {
  'AYT|Matematik|Türev': [
    q('ayt-tv-c1', 'f(x) = x² − 4x + 1 için f′(3) değeri kaçtır?', ['1', '2', '3', '5', '6'], 1, 'f′(x)=2x−4, f′(3)=2.', 'Kolay', 'AYT'),
    q('ayt-tv-c2', 'f(x) = 3x³ − x için f′(x) hangisidir?', ['9x² − 1', '9x² + 1', '6x² − 1', '3x² − 1', '9x − 1'], 0, 'Kuvvet kuralı: 9x² − 1.', 'Kolay', 'AYT'),
    q('ayt-tv-c3', 'Bir cismin konumu x(t)=t² + t metredir. t=2 saniyedeki anlık hız kaç m/s’tir?', ['3', '4', '5', '6', '8'], 2, 'v=x′=2t+1; t=2 iken 5.', 'Orta', 'AYT'),
    q('ayt-tv-c4', 'f(x)=(2x+1)(x−3) için f′(x) hangisidir?', ['4x−5', '4x−7', '2x−5', '4x+5', '2x−3'], 0, 'Çarpım: 2(x−3)+(2x+1)=4x−5.', 'Orta', 'AYT'),
    q('ayt-tv-c5', 'y = 1/x için dy/dx (x≠0) hangisidir?', ['1/x²', '−1/x²', '−1/x', 'x²', 'ln x'], 1, 'x⁻¹ türevi −x⁻².', 'Orta', 'AYT'),
    q('ayt-tv-c6', 'f(x)=sin x için f′(π) değeri kaçtır? (radyan)', ['−1', '0', '1', 'π', 'tan π'], 0, 'cos π = −1.', 'Orta', 'AYT'),
    q('ayt-tv-c7', 'f, x=2’de türevlenebilir ve f(2)=1, f′(2)=4. g(x)=3f(x) için g′(2) kaçtır?', ['3', '4', '7', '12', '15'], 3, 'g′=3f′ ⇒ 12.', 'Kolay', 'AYT'),
    q('ayt-tv-c8', 'f(x)=x² kapalı [0,3] aralığında ortalama değişim oranı kaçtır?', ['1', '2', '3', '6', '9'], 2, '(f(3)−f(0))/3 = 9/3 = 3.', 'Orta', 'AYT'),
  ],
  'AYT|Matematik|Limit': [
    q('ayt-lm-c1', 'lim(x→3) (2x+1) değeri kaçtır?', ['5', '6', '7', '8', 'tanımsız'], 2, 'Polinomda doğrudan yerine koyma: 7.', 'Kolay', 'AYT'),
    q('ayt-lm-c2', 'lim(x→2) (x²−4)/(x−2) değeri kaçtır?', ['0', '2', '4', 'tanımsız', '∞'], 2, 'Sadeleştir (x+2) → 4.', 'Orta', 'AYT'),
    q('ayt-lm-c3', 'lim(x→∞) (3x+1)/(x+5) değeri kaçtır?', ['0', '1', '3', '5', '∞'], 2, 'En yüksek dereceli katsayılar: 3/1=3.', 'Orta', 'AYT'),
    q('ayt-lm-c4', 'lim(x→0) sin(x)/x değeri (x radyan) kaçtır?', ['0', '1', 'π', 'tanımsız', '∞'], 1, 'Standart limit 1.', 'Zor', 'AYT'),
  ],
  'TYT|Matematik|Fonksiyonlar': [
    q('tyt-fn-c1', 'f(x)=2x−5 için f(4) kaçtır?', ['1', '3', '4', '8', '13'], 1, '8−5=3.', 'Kolay', 'TYT'),
    q('tyt-fn-c2', '(f∘g)(x)=f(g(x)) tanımına göre f(x)=x+1, g(x)=2x ise (f∘g)(3) kaçtır?', ['5', '6', '7', '8', '9'], 2, 'g(3)=6, f(6)=7.', 'Orta', 'TYT'),
  ],
};
