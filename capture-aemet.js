const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Devuelve la fecha de mañana en Madrid con formato YYYYMMDD.
 */
function getTomorrowStampMadrid() {
  // Añadimos 24 horas y después formateamos utilizando la zona de Madrid.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .format(tomorrow)
    .replaceAll('-', '');
}

/**
 * Intenta cerrar el aviso de cookies de AEMET.
 */
async function acceptCookies(page) {
  const selectors = [
    'button:has-text("Aceptar cookies")',
    'a:has-text("Aceptar cookies")',
    'input[value*="Aceptar cookies"]',
    'text="Aceptar cookies"'
  ];

  for (const selector of selectors) {
    try {
      await page.locator(selector).first().click({
        timeout: 3000
      });

      console.log('Aviso de cookies cerrado.');
      return;
    } catch {
      // Probamos el siguiente selector.
    }
  }

  console.log('No se encontró el aviso de cookies o ya estaba aceptado.');
}

(async () => {
  let browser;

  try {
    fs.mkdirSync('docs/archive', { recursive: true });

    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1200,
        height: 1000
      },
      deviceScaleFactor: 1
    });

    console.log('Abriendo la página de avisos de mañana...');

    await page.goto(
      'https://www.aemet.es/es/eltiempo/prediccion/avisos?datos=img&f=AT&w=mna',
      {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      }
    );

    await acceptCookies(page);

    // Esperamos a que exista el mapa interactivo.
    const map = page.locator('.leaflet-container').first();

    await map.waitFor({
      state: 'visible',
      timeout: 60000
    });

    // Esperamos a que las imágenes internas del mapa terminen de cargar.
    await page
      .waitForFunction(
        () => {
          const mapElement = document.querySelector('.leaflet-container');

          if (!mapElement) {
            return false;
          }

          const tiles = Array.from(
            mapElement.querySelectorAll('img.leaflet-tile')
          );

          return (
            tiles.length > 0 &&
            tiles.every(
              (tile) =>
                tile.complete &&
                typeof tile.naturalWidth === 'number' &&
                tile.naturalWidth > 0
            )
          );
        },
        null,
        {
          timeout: 30000
        }
      )
      .catch(() => {
        console.log(
          'No se pudo confirmar la carga de todas las teselas; se continuará.'
        );
      });

    // Tiempo adicional para que aparezcan límites y colores.
    await page.waitForTimeout(2500);

    const tomorrowStamp = getTomorrowStampMadrid();

    const latestFile = 'docs/aemet-manana.png';
    const archiveFile =
      `docs/archive/aemet-manana-${tomorrowStamp}.png`;

    /*
     * Capturamos únicamente el contenedor del mapa.
     * Esto evita:
     * - la cabecera;
     * - el aviso de cookies;
     * - el panel izquierdo;
     * - el corte de la parte inferior.
     */
    await map.screenshot({
      path: latestFile,
      type: 'png'
    });

    // Copia histórica correspondiente a la fecha de mañana.
    fs.copyFileSync(latestFile, archiveFile);

    console.log(`Imagen actualizada: ${latestFile}`);
    console.log(`Imagen archivada: ${archiveFile}`);
  } catch (error) {
    console.error('Error durante la captura:', error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
