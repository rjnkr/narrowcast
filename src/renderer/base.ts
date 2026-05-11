export function baseHtml(title: string, styles: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
@font-face{font-family:"Roobert";src:url("/assets/fonts/Roobert-Regular.woff2") format("woff2"),url("/assets/fonts/Roobert-Regular.woff") format("woff");font-weight:400;font-style:normal}
@font-face{font-family:"Roobert";src:url("/assets/fonts/Roobert-Medium.woff2") format("woff2"),url("/assets/fonts/Roobert-Medium.woff") format("woff");font-weight:500;font-style:normal}
@font-face{font-family:"Roobert";src:url("/assets/fonts/Roobert-SemiBold.woff2") format("woff2"),url("/assets/fonts/Roobert-SemiBold.woff") format("woff");font-weight:600;font-style:normal}
@font-face{font-family:"Roobert";src:url("/assets/fonts/Roobert-Bold.woff2") format("woff2"),url("/assets/fonts/Roobert-Bold.woff") format("woff");font-weight:700;font-style:normal}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--accent:#ccf535;--dark:#071e2e;--blue:#0e4362;--beige:#f8e7c4}
body{width:100%;height:100vh;background:var(--dark);color:#fff;
  font-family:"Roobert","Inter","DM Sans",sans-serif;overflow:hidden}
${styles}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function esc(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
