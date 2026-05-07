import { baseHtml, esc } from './base';

export function renderPlaceholder(title: string, icon: string): string {
  return baseHtml('Pipedrive', `
    body{background:#f8e7c4;display:flex;align-items:center;justify-content:center}
    .card{display:flex;flex-direction:column;align-items:center;gap:20px;
      text-align:center;padding:48px}
    .logo img{height:48px;object-fit:contain}
    .logo-fallback{display:none;font-size:32px;font-weight:700;letter-spacing:4px;color:#0e4362}
    .icon{font-size:72px;line-height:1}
    h2{font-size:38px;font-weight:700;color:#0e4362}
    .sub{font-size:18px;color:rgba(14,67,98,.6)}
    .badge{background:#0e4362;color:#ccf535;font-size:13px;font-weight:700;
      letter-spacing:2px;text-transform:uppercase;padding:8px 24px;border-radius:50px}
  `, `
    <div class="card">
      <div class="logo">
        <img src="/assets/tidalis-logo.svg" alt="Tidalis"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span class="logo-fallback">TIDALIS</span>
      </div>
      <div class="icon">${icon}</div>
      <h2>${esc(title)}</h2>
      <p class="sub">Pipedrive CRM integratie</p>
      <div class="badge">Coming soon</div>
    </div>`);
}
