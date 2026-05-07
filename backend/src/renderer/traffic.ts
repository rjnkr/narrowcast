import { TrafficData } from '../types';
import { baseHtml, esc } from './base';

function jamColor(causeType: string): string {
  if (causeType === 'congestion') return '#e53935';
  if (causeType === 'carriagewayClosed') return '#e05c2a';
  return '#f5a623';
}

function jamLabel(causeType: string): string {
  if (causeType === 'congestion') return 'File';
  if (causeType === 'carriagewayClosed') return 'Afgesloten';
  return 'Werkzaamheden';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export function renderTraffic(data: TrafficData | null | undefined): string {
  const jams = data?.jams ?? [];
  const fetchedAt = data?.fetchedAt;

  const jamListHtml = jams.length === 0
    ? `<div class="no-jams"><div class="no-jams-icon">✅</div><div>Geen files</div></div>`
    : `<div class="jam-list">${jams.map(jam => `
        <div class="jam-card">
          <div class="jam-header">
            <span class="road-badge">${esc(jam.road)}</span>
            <span class="jam-type" style="color:${jamColor(jam.causeType)}">${jamLabel(jam.causeType)}</span>
            ${jam.distanceFromApeldoorn !== undefined
              ? `<span class="jam-dist">${jam.distanceFromApeldoorn} km</span>`
              : ''}
          </div>
          ${(jam.from || jam.to) ? `
          <div class="jam-route">
            ${esc(jam.from)}
            ${jam.from && jam.to ? '<span class="arrow">›</span>' : ''}
            ${esc(jam.to)}
          </div>` : ''}
          ${jam.reason ? `<div class="jam-reason">${esc(jam.reason)}</div>` : ''}
        </div>`).join('')}</div>`;

  return baseHtml('Verkeer', `
    .slide{width:100%;height:100%;display:flex;background:#071e2e}
    .map-wrap{flex:0 0 62%;height:100%;overflow:hidden;background:#1a2e3e;
      display:flex;align-items:center;justify-content:center}
    .map-wrap img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
    .panel{flex:1;display:flex;flex-direction:column;padding:22px 18px;
      border-left:2px solid rgba(204,245,53,.12);overflow:hidden}
    .panel-hdr{display:flex;justify-content:space-between;align-items:baseline;
      margin-bottom:16px;flex-shrink:0}
    .panel-title{font-size:32px;font-weight:700;color:#ccf535;letter-spacing:1px}
    .panel-time{font-size:14px;color:rgba(255,255,255,.4)}
    .no-jams{flex:1;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:14px;font-size:18px;color:rgba(255,255,255,.55)}
    .no-jams-icon{font-size:44px}
    .jam-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
    .jam-list::-webkit-scrollbar{width:3px}
    .jam-list::-webkit-scrollbar-thumb{background:rgba(204,245,53,.25);border-radius:3px}
    .jam-card{background:rgba(255,255,255,.05);border-left:3px solid #e53935;
      border-radius:0 6px 6px 0;padding:10px 14px;display:flex;flex-direction:column;gap:5px}
    .jam-header{display:flex;align-items:center;gap:8px}
    .road-badge{background:#c0392b;color:#fff;font-size:16px;font-weight:700;
      padding:3px 12px;border-radius:4px;letter-spacing:.5px;white-space:nowrap}
    .jam-type{font-size:15px;font-weight:600}
    .jam-dist{margin-left:auto;font-size:14px;color:rgba(255,255,255,.4);white-space:nowrap}
    .jam-route{font-size:18px;color:rgba(255,255,255,.85);display:flex;align-items:center;
      flex-wrap:wrap;gap:4px;line-height:1.3}
    .arrow{color:#ccf535}
    .jam-reason{font-size:14px;color:rgba(255,255,255,.5);line-height:1.35;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  `, `
    <div class="slide">
      <div class="map-wrap">
        <img id="map" src="/static/verkeerplaza-map.png?t=${Date.now()}" alt="Verkeerkaart">
      </div>
      <div class="panel">
        <div class="panel-hdr">
          <span class="panel-title">Files</span>
          ${fetchedAt ? `<span class="panel-time">${formatTime(fetchedAt)}</span>` : ''}
        </div>
        ${jamListHtml}
      </div>
    </div>
    <script>
      setInterval(function() {
        document.getElementById('map').src = '/static/verkeerplaza-map.png?t=' + Date.now();
      }, 600000);
    </script>`);
}
