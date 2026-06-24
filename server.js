const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - alle dürfen zugreifen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Cache damit nicht bei jedem Aufruf neu geholt wird
let cache = {
  ej: null,
  lotto: null,
  ejTime: 0,
  lottoTime: 0
};
const CACHE_MINUTES = 30;

// ===== EUROJACKPOT =====
async function fetchEJ() {
  const now = Date.now();
  if (cache.ej && (now - cache.ejTime) < CACHE_MINUTES * 60 * 1000) {
    return cache.ej;
  }

  try {
    // Sachsenlotto hat strukturierte EJ-Daten
    const url = 'https://www.lotto.de/eurojackpot/gewinnzahlen';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const drawings = { tue: [], fri: [] };

    // Ziehungen parsen - lotto.de Struktur
    $('.drawing-result, .result-row, [class*="drawing"], [class*="result"]').each((i, el) => {
      if (i >= 40) return;
      const nums = [];
      const euros = [];
      $(el).find('.ball, .number, [class*="ball"], [class*="number"]').each((j, ball) => {
        const n = parseInt($(ball).text().trim());
        if (!isNaN(n) && n >= 1 && n <= 50) nums.push(n);
      });
      $(el).find('.euro, .star, [class*="euro"], [class*="star"]').each((j, star) => {
        const n = parseInt($(star).text().trim());
        if (!isNaN(n) && n >= 1 && n <= 12) euros.push(n);
      });

      const dateEl = $(el).find('.date, [class*="date"]').first().text().trim();
      if (nums.length === 5 && euros.length === 2) {
        // Datum prüfen für Di/Fr Trennung
        const dateStr = dateEl.toLowerCase();
        const isTue = dateStr.includes('di') || dateStr.includes('tue');
        const day = isTue ? 'tue' : 'fri';
        if (drawings[day].length < 20) {
          drawings[day].push({ numbers: nums, euro: euros, date: dateEl });
        }
      }
    });

    // Fallback: eurojackpot-zahlen.eu
    if (drawings.tue.length < 5 || drawings.fri.length < 5) {
      const r2 = await fetch('https://eurojackpot-zahlen.eu/alle-eurojackpot-zahlen/', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const h2 = await r2.text();
      const $2 = cheerio.load(h2);

      $2('table tr, .draw-row').each((i, row) => {
        if (i === 0) return; // header
        const cells = $2(row).find('td');
        if (cells.length < 3) return;

        const dateStr = $2(cells[0]).text().trim();
        const isTue = dateStr.includes('Di') || dateStr.includes('Tue') ||
                      new Date(dateStr.split('.').reverse().join('-')).getDay() === 2;

        const nums = [], euros = [];
        $2(cells).each((j, cell) => {
          const n = parseInt($2(cell).text().trim());
          if (!isNaN(n)) {
            if (n >= 1 && n <= 50 && nums.length < 5) nums.push(n);
            else if (n >= 1 && n <= 12 && euros.length < 2) euros.push(n);
          }
        });

        if (nums.length === 5 && euros.length === 2) {
          const day = isTue ? 'tue' : 'fri';
          if (drawings[day].length < 20) {
            drawings[day].push({ numbers: nums, euro: euros, date: dateStr });
          }
        }
      });
    }

    cache.ej = drawings;
    cache.ejTime = now;
    return drawings;
  } catch (e) {
    console.error('EJ fetch error:', e.message);
    return cache.ej || { tue: [], fri: [], error: e.message };
  }
}

// ===== LOTTO 6aus49 =====
async function fetchLotto() {
  const now = Date.now();
  if (cache.lotto && (now - cache.lottoTime) < CACHE_MINUTES * 60 * 1000) {
    return cache.lotto;
  }

  try {
    const url = 'https://www.lotto.de/lotto-6aus49/gewinnzahlen';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const drawings = { wed: [], sat: [] };

    $('.drawing-result, .result-row, [class*="drawing"]').each((i, el) => {
      if (i >= 40) return;
      const nums = [], sz = [];
      $(el).find('.ball, .number, [class*="ball"]').each((j, ball) => {
        const n = parseInt($(ball).text().trim());
        if (!isNaN(n) && n >= 1 && n <= 49 && nums.length < 6) nums.push(n);
      });
      $(el).find('.superzahl, [class*="super"], [class*="zusatz"]').each((j, sz_el) => {
        const n = parseInt($(sz_el).text().trim());
        if (!isNaN(n) && n >= 0 && n <= 9) sz.push(n);
      });

      const dateEl = $(el).find('.date, [class*="date"]').first().text().trim();
      if (nums.length === 6) {
        const dateStr = dateEl.toLowerCase();
        const isSat = dateStr.includes('sa') || dateStr.includes('sat');
        const day = isSat ? 'sat' : 'wed';
        if (drawings[day].length < 20) {
          drawings[day].push({ numbers: nums, sz: sz[0] ?? null, date: dateEl });
        }
      }
    });

    cache.lotto = drawings;
    cache.lottoTime = now;
    return drawings;
  } catch (e) {
    console.error('Lotto fetch error:', e.message);
    return cache.lotto || { wed: [], sat: [], error: e.message };
  }
}

// ===== ROUTEN =====
app.get('/', (req, res) => {
  res.json({ status: 'JackpotMax Server läuft ✅', version: '1.0' });
});

app.get('/ej', async (req, res) => {
  const data = await fetchEJ();
  res.json(data);
});

app.get('/lotto', async (req, res) => {
  const data = await fetchLotto();
  res.json(data);
});

// Ping-Route für UptimeRobot
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`JackpotMax Server läuft auf Port ${PORT}`);
});
