import { baseHtml } from './base';

export function renderBuienradar(): string {
  return baseHtml('Buienradar', `
    body{background:#000;display:flex;align-items:center;justify-content:center}
    .title{position:absolute;top:20px;left:32px;font-size:28px;font-weight:700;
      color:#ccf535;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,.6)}
    img{width:100%;height:100%;object-fit:contain}
  `, `
    <span class="title">Neerslag — nu</span>
    <img id="radar" src="/static/buienradar.gif?t=${Date.now()}" alt="Buienradar">
    <script>
      setInterval(function() {
        document.getElementById('radar').src = '/static/buienradar.gif?t=' + Date.now();
      }, 600000);
    </script>`);
}
