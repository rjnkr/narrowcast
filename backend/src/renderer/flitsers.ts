import { FlitsData, SpitsData, SpitsVerwachting } from '../types';
import { baseHtml, esc } from './base';

const SEVERITY_LABEL: Record<number, string> = {
  1: 'Licht',
  2: 'Matig',
  3: 'Gemiddeld',
  4: 'Druk',
  5: 'Zeer druk',
};
const SEVERITY_COLOR: Record<number, string> = {
  1: '#4caf50',
  2: '#8bc34a',
  3: '#ffc107',
  4: '#ff9800',
  5: '#f44336',
};

function barColor(value: number): string {
  if (value <= 30) return '#4caf50';
  if (value <= 55) return '#ffc107';
  if (value <= 75) return '#ff9800';
  return '#f44336';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function buildChart(prediction: SpitsVerwachting): string {
  const moments = prediction.moments;
  if (!moments.length) return '<div class="no-chart">Geen data</div>';

  const W = 480, H = 260, PAD_L = 28, PAD_B = 34, PAD_T = 12, PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const barW = Math.floor(chartW / moments.length) - 2;

  const bars = moments.map((m, i) => {
    const x = PAD_L + i * (chartW / moments.length);
    const expH = Math.round((m.expected / 100) * chartH);
    const avgH = Math.round((m.average / 100) * chartH);
    const showLabel = i % 4 === 0; // label every hour
    return `
      <rect x="${x + 1}" y="${PAD_T + chartH - expH}" width="${barW}" height="${expH}"
            fill="${barColor(m.expected)}" opacity="0.85"/>
      <line x1="${x + barW / 2}" y1="${PAD_T + chartH - avgH}"
            x2="${x + barW / 2 + (chartW / moments.length)}" y2="${PAD_T + chartH - avgH}"
            stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      ${showLabel ? `<text x="${x + 1}" y="${H - 10}" fill="rgba(255,255,255,.55)"
            font-size="11" font-family="sans-serif">${esc(m.time)}</text>` : ''}`;
  }).join('');

  // Y-axis gridlines
  const gridLines = [25, 50, 75, 100].map(v => {
    const y = PAD_T + chartH - Math.round((v / 100) * chartH);
    return `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}"
              stroke="rgba(255,255,255,.08)" stroke-width="1"/>
            <text x="2" y="${y + 3}" fill="rgba(255,255,255,.35)"
              font-size="10" font-family="sans-serif">${v}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${gridLines}
    ${bars}
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + chartH}"
          stroke="rgba(255,255,255,.2)" stroke-width="1"/>
    <line x1="${PAD_L}" y1="${PAD_T + chartH}" x2="${W - PAD_R}" y2="${PAD_T + chartH}"
          stroke="rgba(255,255,255,.2)" stroke-width="1"/>
  </svg>`;
}

function todayPM(data: SpitsData | null | undefined): SpitsVerwachting | null {
  if (!data?.predictions?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return data.predictions.find(p => p.date === today && p.daypart === 'PM')
    ?? data.predictions.find(p => p.daypart === 'PM')
    ?? null;
}

export function renderFlitsers(flitsData: FlitsData | null | undefined, spitsData: SpitsData | null | undefined): string {
  const flitsers = flitsData?.flitsers ?? [];
  const prediction = todayPM(spitsData);
  const sevColor = prediction ? (SEVERITY_COLOR[prediction.severity] ?? '#ffc107') : '#ffc107';
  const sevLabel = prediction ? (SEVERITY_LABEL[prediction.severity] ?? '') : '';

  const flitserRows = flitsers.length === 0
    ? `<div class="no-items"><div style="font-size:36px">✅</div><div>Geen flitsers</div></div>`
    : flitsers.map(f => `
        <div class="flitser-card">
          <div class="f-header">
            <span class="road-badge">${esc(f.road)}</span>
            <span class="f-dir">${esc(f.direction)}</span>
            ${f.hm !== undefined ? `<span class="f-hm">hm ${f.hm.toFixed(1)}</span>` : ''}
          </div>
          <div class="f-route">${esc(f.from)} <span class="arrow">›</span> ${esc(f.to)}</div>
        </div>`).join('');

  const spitsBlock = prediction ? `
    <div class="sev-row">
      <span class="sev-dot" style="background:${sevColor}"></span>
      <span class="sev-label" style="color:${sevColor}">${esc(sevLabel)}</span>
      <span class="sev-time">Avondspits vandaag</span>
    </div>
    <div class="chart-wrap">${buildChart(prediction)}</div>
    <div class="sev-desc">${esc(stripHtml(prediction.content))}</div>
  ` : `<div class="no-items"><div style="font-size:36px">📊</div><div>Geen verwachting</div></div>`;

  return baseHtml('Flitsers & Spitsverwachting', `
    .slide{width:100%;height:100%;display:flex;background:#071e2e}
    /* ── Left: flitsers ── */
    .left{flex:0 0 52%;display:flex;flex-direction:column;
      padding:22px 18px;border-right:2px solid rgba(204,245,53,.12);overflow:hidden}
    .panel-hdr{display:flex;justify-content:space-between;align-items:baseline;
      margin-bottom:14px;flex-shrink:0}
    .panel-title{font-size:28px;font-weight:700;color:#ccf535;letter-spacing:1px}
    .panel-time{font-size:13px;color:rgba(255,255,255,.4)}
    .flitser-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
    .flitser-list::-webkit-scrollbar{width:3px}
    .flitser-list::-webkit-scrollbar-thumb{background:rgba(204,245,53,.25);border-radius:3px}
    .flitser-card{background:rgba(255,255,255,.05);border-left:3px solid #f5a623;
      border-radius:0 6px 6px 0;padding:9px 12px;display:flex;flex-direction:column;gap:4px}
    .f-header{display:flex;align-items:center;gap:8px}
    .road-badge{background:#c0392b;color:#fff;font-size:15px;font-weight:700;
      padding:2px 10px;border-radius:4px;white-space:nowrap}
    .f-dir{font-size:13px;color:rgba(255,255,255,.6);flex:1}
    .f-hm{font-size:12px;color:rgba(255,255,255,.35);white-space:nowrap}
    .f-route{font-size:16px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:4px}
    .arrow{color:#ccf535}
    .no-items{flex:1;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:12px;font-size:17px;color:rgba(255,255,255,.5)}
    /* ── Right: spitsverwachting ── */
    .right{flex:1;display:flex;flex-direction:column;padding:22px 18px;overflow:hidden;gap:14px}
    .sev-row{display:flex;align-items:center;gap:10px;flex-shrink:0}
    .sev-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0}
    .sev-label{font-size:20px;font-weight:700}
    .sev-time{font-size:13px;color:rgba(255,255,255,.45);margin-left:auto}
    .chart-wrap{flex:1;min-height:0;display:flex;align-items:stretch}
    .chart-wrap svg{width:100%;height:100%}
    .no-chart{font-size:14px;color:rgba(255,255,255,.4)}
    .sev-desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.45;
      display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;
      flex-shrink:0}
  `, `
    <div class="slide">
      <div class="left">
        <div class="panel-hdr">
          <span class="panel-title">⚡ Flitsers</span>
          ${flitsData?.fetchedAt ? `<span class="panel-time">${new Date(flitsData.fetchedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
        </div>
        <div class="flitser-list">${flitserRows}</div>
      </div>
      <div class="right">
        <div class="panel-hdr">
          <span class="panel-title">📈 Spitsverwachting</span>
        </div>
        ${spitsBlock}
      </div>
    </div>`);
}
