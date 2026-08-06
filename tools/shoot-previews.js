// Odświeża preview-*.png dla huba (index.html). Tryb eksportu (?nopanel=1),
// żeby pływający panel demo nie wchodził na zrzut.
//   node tools/shoot-previews.js [nazwa ...]
const puppeteer = require('puppeteer-core');
const path = require('path');
const chromePath = require('./chrome-path');

const CHROME = chromePath();
const ROOT = path.resolve(__dirname, '..');

const PAGES = [
  ['home', 'home.html', 1440], ['home-b', 'home-b.html', 1440],
  ['home-c', 'home-c.html', 1440], ['home-c-en', 'home-c-en.html', 1440], ['home-d', 'home-d.html', 1440],
  ['listing', 'listing.html', 1440], ['listing-b', 'listing-b.html', 1440], ['listing-c', 'listing-c.html', 1440],
  ['hotel', 'hotel.html', 1440], ['checkout', 'checkout.html', 1440], ['thankyou', 'thankyou.html', 1440],
  ['m-home', 'm-home.html', 500], ['m-listing', 'm-listing.html', 500], ['m-hotel', 'm-hotel.html', 500],
  ['m-checkout', 'm-checkout.html', 500], ['m-thankyou', 'm-thankyou.html', 500],
];

(async () => {
  const only = process.argv.slice(2);
  const list = only.length ? PAGES.filter(p => only.includes(p[0])) : PAGES;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  for (const [name, file, w] of list) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 1000 });
    await page.goto('file://' + path.join(ROOT, file) + '?nopanel=1', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: path.join(ROOT, 'preview-' + name + '.png'), fullPage: true });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log('  ok  preview-' + name + '.png  ' + w + '×' + h);
    await page.close();
  }
  await browser.close();
})();
