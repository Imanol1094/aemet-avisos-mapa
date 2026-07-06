const { chromium } = require('playwright');
const fs = require('fs');

function getTomorrowStampMadrid() {
  const nowMadrid = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  );

  nowMadrid.setDate(nowMadrid.getDate() + 1);

  const y = nowMadrid.getFullYear();
  const m = String(nowMadrid.getMonth() + 1).padStart(2, '0');
  const d = String(nowMadrid.getDate()).padStart(2, '0');

  return `${y}${m}${d}`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    viewport: { width: 1200, height: 1100 }
  });

  await page.goto(
    'https://www.aemet.es/es/eltiempo/prediccion/avisos?datos=img&f=AT&w=mna',
    {
      waitUntil: 'load',
      timeout: 60000
    }
  );

  await page.waitForTimeout(2500);

  fs.mkdirSync('docs/archive', { recursive: true });
  fs.writeFileSync('docs/.nojekyll', '');

  const stamp = getTomorrowStampMadrid();

  await page.screenshot({
    path: 'docs/aemet-manana.png',
    type: 'png'
  });

  await page.screenshot({
    path: `docs/archive/aemet-manana-${stamp}.png`,
    type: 'png'
  });

  await browser.close();
})();
