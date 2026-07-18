const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--hide-scrollbars'],
  });
  const pages = [
    ['home', 'https://www.litoralulromanesc.ro/'],
    ['search', 'https://www.litoralulromanesc.ro/cauta.htm?city_id=1&checkin_date=05%2F08%2F2026&checkout_date=12%2F08%2F2026&count_adults=2&count_kids=0'],
    ['hotel', 'https://www.litoralulromanesc.ro/hotel_mediteranean_mamaia.htm?checkin_date=05%2F08%2F2026&checkout_date=12%2F08%2F2026&count_adults=2&count_kids=0&auto_book=1'],
  ];
  for (const [name, url] of pages) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 1000 });
    try {
      await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(r => setTimeout(r, 3000));
      const txt = await p.evaluate(() => {
        const body = document.body.innerText;
        const form = document.querySelector('#booking-form');
        return body + (form ? '\n\n===== BOOKING FORM (hidden) =====\n' + form.textContent.replace(/[ \t]+/g, ' ') : '');
      });
      fs.writeFileSync(`live/rendered_${name}.txt`, txt);
      await p.screenshot({ path: `live/shot_${name}.png`, fullPage: name !== 'search' });
      console.log(name, txt.length, 'chars');
    } catch (e) { console.log(name, 'ERR', e.message); }
    await p.close();
  }
  await browser.close();
})();
