const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS - alles erlauben
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// Ping für UptimeRobot
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Root
app.get('/', (req, res) => {
  res.json({ status: 'JackpotMax Server läuft ✅', version: '2.0' });
});

// ===== EUROJACKPOT =====
app.get('/ej', async (req, res) => {
  try {
    // Letzte EJ-Ziehungen von eurojackpot-zahlen.eu
    const url = 'https://eurojackpot-zahlen.eu/eurojackpot-zahlen-archiv/';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9'
      },
      timeout: 15000
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const tue = [], fri = [];

    // Tabellen-Zeilen parsen
    $('table tr, .archiv-row, .ziehung-row, tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const dateText = $(cells[0]).text().trim();
      if (!dateText || dateText.length < 5) return;

      // Zahlen aus Zellen extrahieren
      const allNums = [];
      cells.each((j, cell) => {
        const txt = $(cell).text().trim();
        const n = parseInt(txt);
        if (!isNaN(n) && n >= 1 && n <= 50) allNums.push(n);
      });

      if (allNums.length < 7) return;

      const numbers = allNums.slice(0, 5);
      const euro = allNums.slice(5, 7);

      // Tag bestimmen (Di=Dienstag, Fr=Freitag)
      const d = new Date(dateText.split('.').reverse().join('-'));
      const isTue = d.getDay() === 2;
      const isFri = d.getDay() === 5;

      if (isTue && tue.length < 20) tue.push({ numbers, euro, date: dateText });
      else if (isFri && fri.length < 20) fri.push({ numbers, euro, date: dateText });
    });

    res.json({ tue, fri, source: 'eurojackpot-zahlen.eu' });
  } catch (e) {
    res.json({ tue: [], fri: [], error: e.message });
  }
});

// ===== LOTTO =====
app.get('/lotto', async (req, res) => {
  try {
    const url = 'https://www.lotto-zahlen.de/lotto-archiv/';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9'
      },
      timeout: 15000
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const wed = [], sat = [];

    $('table tr, tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const dateText = $(cells[0]).text().trim();
      if (!dateText || dateText.length < 5) return;

      const allNums = [];
      let sz = null;
      cells.each((j, cell) => {
        const txt = $(cell).text().trim();
        const n = parseInt(txt);
        if (!isNaN(n) && n >= 1 && n <= 49 && allNums.length < 6) allNums.push(n);
        else if (!isNaN(n) && n >= 0 && n <= 9 && allNums.length === 6 && sz === null) sz = n;
      });

      if (allNums.length < 6) return;

      const d = new Date(dateText.split('.').reverse().join('-'));
      const isWed = d.getDay() === 3;
      const isSat = d.getDay() === 6;

      if (isWed && wed.length < 20) wed.push({ numbers: allNums, sz, date: dateText });
      else if (isSat && sat.length < 20) sat.push({ numbers: allNums, sz, date: dateText });
    });

    res.json({ wed, sat, source: 'lotto-zahlen.de' });
  } catch (e) {
    res.json({ wed: [], sat: [], error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JackpotMax Server läuft auf Port ${PORT}`);
});
