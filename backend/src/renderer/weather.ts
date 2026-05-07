import { WeatherData } from '../types';
import { baseHtml, esc } from './base';

const WMO_MAP: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Helder',               icon: '☀️' },
  1:  { label: 'Overwegend helder',    icon: '🌤️' },
  2:  { label: 'Gedeeltelijk bewolkt', icon: '⛅' },
  3:  { label: 'Bewolkt',              icon: '☁️' },
  45: { label: 'Mist',                 icon: '🌫️' },
  48: { label: 'Rijpmist',             icon: '🌫️' },
  51: { label: 'Lichte motregen',      icon: '🌦️' },
  53: { label: 'Motregen',             icon: '🌦️' },
  55: { label: 'Dichte motregen',      icon: '🌧️' },
  61: { label: 'Lichte regen',         icon: '🌧️' },
  63: { label: 'Regen',                icon: '🌧️' },
  65: { label: 'Zware regen',          icon: '🌧️' },
  71: { label: 'Lichte sneeuw',        icon: '🌨️' },
  73: { label: 'Sneeuw',               icon: '❄️' },
  75: { label: 'Zware sneeuw',         icon: '❄️' },
  80: { label: 'Lichte bui',           icon: '🌦️' },
  81: { label: 'Buien',                icon: '🌧️' },
  82: { label: 'Zware buien',          icon: '⛈️' },
  95: { label: 'Onweer',               icon: '⛈️' },
  99: { label: 'Zwaar onweer',         icon: '🌩️' },
};

function wmo(code: number) {
  return WMO_MAP[code] ?? { label: 'Onbekend', icon: '🌡️' };
}

export function renderWeather(data: WeatherData | null | undefined): string {
  if (!data) {
    return baseHtml('Weerbericht', `
      body{display:flex;align-items:center;justify-content:center;
        background:linear-gradient(160deg,#0e4362,#071e2e)}
      .msg{font-size:24px;opacity:.5}
    `, '<div class="msg">Geen weerdata beschikbaar</div>');
  }

  const cards = data.days.map((day, i) => {
    const { icon, label } = wmo(day.wmoCode);
    return `
      <div class="card${i === 0 ? ' card--today' : ''}">
        <div class="day-name">${esc(day.weekday)}</div>
        <div class="day-icon">${icon}</div>
        <div class="day-desc">${esc(label)}</div>
        <div class="temps">
          <span class="temp-max">${Math.round(day.tempMax)}°</span>
          <span class="temp-min">${Math.round(day.tempMin)}°</span>
        </div>
        ${day.precipitation > 0 ? `<div class="precip">💧 ${day.precipitation.toFixed(1)} mm</div>` : ''}
      </div>`;
  }).join('');

  return baseHtml('Weerbericht', `
    .weather{width:100%;height:100%;
      background:linear-gradient(160deg,#0e4362 0%,#0a2d45 60%,#071e2e 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:40px;gap:40px}
    .title{text-align:center}
    .city{display:block;font-size:42px;font-weight:700;letter-spacing:2px}
    .subtitle{display:block;font-size:16px;color:rgba(255,255,255,.5);
      letter-spacing:1px;margin-top:4px}
    .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:20px;
      width:100%;max-width:1100px}
    .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
      border-radius:12px;padding:28px 16px;display:flex;flex-direction:column;
      align-items:center;gap:10px}
    .card--today{background:rgba(204,245,53,.1);border-color:rgba(204,245,53,.3)}
    .day-name{font-size:15px;font-weight:600;color:#ccf535;letter-spacing:1px;
      text-transform:uppercase}
    .day-icon{font-size:52px;line-height:1}
    .day-desc{font-size:14px;color:rgba(255,255,255,.65);text-align:center}
    .temps{display:flex;gap:12px;align-items:baseline}
    .temp-max{font-size:34px;font-weight:700}
    .temp-min{font-size:22px;color:rgba(255,255,255,.4)}
    .precip{font-size:13px;color:rgba(255,255,255,.55)}
  `, `
    <div class="weather">
      <div class="title">
        <span class="city">${esc(data.city)}</span>
        <span class="subtitle">Weerbericht — 5 daagse verwachting</span>
      </div>
      <div class="grid">${cards}</div>
    </div>`);
}
