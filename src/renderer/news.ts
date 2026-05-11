import { NewsArticle } from '../types';
import { baseHtml, esc } from './base';

const SOURCE_COLORS: Record<string, string> = {
  schuttevaer: '#0e4362',
  bnr:         '#c8102e',
  nos:         '#cc0000',
};

const FALLBACK_GRADIENTS: Record<string, string> = {
  schuttevaer: 'linear-gradient(135deg,#0e4362 0%,#1a6fa0 100%)',
  bnr:         'linear-gradient(135deg,#1a1a2e 0%,#c8102e 100%)',
  nos:         'linear-gradient(135deg,#1a1a2e 0%,#cc0000 100%)',
};

export function renderNews(article: NewsArticle, sourceLabel: string): string {
  const chipColor = SOURCE_COLORS[article.source] ?? '#0e4362';
  const fallback  = FALLBACK_GRADIENTS[article.source] ?? '#0e4362';
  const bgStyle   = article.imageUrl
    ? `background:url('${article.imageUrl.replace(/'/g, "\\'")}') center top/cover no-repeat`
    : `background:${fallback}`;

  return baseHtml('Nieuws', `
    .slide{position:relative;width:100%;height:100%;overflow:hidden;${bgStyle}}
    .overlay{position:absolute;inset:0;
      background:linear-gradient(to top,
        rgba(7,30,46,.97) 0%,rgba(7,30,46,.85) 35%,
        rgba(7,30,46,.3)  65%,rgba(7,30,46,0)  100%)}
    .content{position:absolute;bottom:0;left:0;right:0;padding:36px 48px;
      display:flex;flex-direction:column;gap:14px}
    .chip{display:inline-flex;align-self:flex-start;padding:5px 16px;border-radius:50px;
      font-size:16px;font-weight:700;letter-spacing:1px;color:#fff;text-transform:uppercase;
      background:${chipColor}}
    .bar{width:56px;height:3px;background:#ccf535;border-radius:2px}
    h2{font-size:clamp(36px,4vw,58px);font-weight:700;line-height:1.2;
      text-shadow:0 2px 12px rgba(0,0,0,.6)}
    p{font-size:clamp(22px,2vw,28px);color:rgba(255,255,255,.8);line-height:1.55;
      display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;
      text-shadow:0 1px 8px rgba(0,0,0,.5)}
  `, `
    <div class="slide">
      <div class="overlay"></div>
      <div class="content">
        <div class="chip">${esc(sourceLabel)}</div>
        <div class="bar"></div>
        <h2>${esc(article.title)}</h2>
        <p>${esc(article.summary)}</p>
      </div>
    </div>`);
}
