import { baseHtml } from './base';

export function renderMsg(): string {
  return baseHtml('MSG', `
    body{background:#000;display:flex;align-items:center;justify-content:center}
    img{width:100%;height:100%;object-fit:contain}
  `, `
    <img id="msg" src="/static/msg.png?t=${Date.now()}" alt="MSG">
    <script>
      setInterval(function() {
        document.getElementById('msg').src = '/static/msg.png?t=' + Date.now();
      }, 600000);
    </script>`);
}
