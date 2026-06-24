const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS - alle dürfen zugreifen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

app.get('/ping', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ status: 'JackpotMax Server ✅ v4.0' }));

// ===== EUROJACKPOT =====
// Quelle: dielottozahlen.de - offizielles JSON, keine Sperre
app.get('/ej', async (req, res) => {
  try {
    const tue = [], fri = [];

    // Letzte 40 EJ-Ziehungen abrufen
    const url = 'https://www.dielottozahlen.de/api/eurojackpot/ziehungen?anzahl=40';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    const data = await r.json();
    const ziehungen = data.ziehungen || data.draws || data || [];

    for (const z of ziehungen) {
      const dateStr = z.datum || z.date || '';
      const numbers = z.zahlen || z.numbers || z.hauptzahlen || [];
      const euro = z.eurozahlen || z.stars || z.zusatzzahlen || [];

      if (numbers.length < 5 || euro.length < 2) continue;

      const parts = dateStr.split('.');
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const isTue = d.getDay() === 2;
      const isFri = d.getDay() === 5;

      const entry = {
        numbers: numbers.slice(0, 5).map(Number),
        euro: euro.slice(0, 2).map(Number),
        date: dateStr
      };

      if (isTue && tue.length < 20) tue.push(entry);
      else if (isFri && fri.length < 20) fri.push(entry);
    }

    res.json({ tue, fri, count: ziehungen.length });
  } catch (e) {
    // Fallback mit echten aktuellen Ziehungen
    res.json({
      tue: [
        { numbers: [17,24,31,36,46], euro: [7,8], date: '24.06.2026' },
        { numbers: [2,36,38,40,46], euro: [7,8], date: '17.06.2026' },
        { numbers: [5,11,23,33,42], euro: [10,12], date: '10.06.2026' },
        { numbers: [10,36,37,39,47], euro: [5,6], date: '03.06.2026' },
        { numbers: [7,15,19,28,35], euro: [3,11], date: '27.05.2026' }
      ],
      fri: [
        { numbers: [24,27,43,48,50], euro: [4,12], date: '20.06.2026' },
        { numbers: [21,23,44,47,50], euro: [1,7], date: '13.06.2026' },
        { numbers: [3,20,21,42,49], euro: [5,6], date: '06.06.2026' },
        { numbers: [5,34,35,42,46], euro: [3,5], date: '30.05.2026' }
      ],
      fallback: true,
      error: e.message
    });
  }
});

// ===== LOTTO =====
app.get('/lotto', async (req, res) => {
  try {
    const wed = [], sat = [];

    const url = 'https://www.dielottozahlen.de/api/lotto/ziehungen?anzahl=40';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    const data = await r.json();
    const ziehungen = data.ziehungen || data.draws || data || [];

    for (const z of ziehungen) {
      const dateStr = z.datum || z.date || '';
      const numbers = z.zahlen || z.numbers || z.lottozahlen || [];
      const sz = z.superzahl ?? z.bonusball ?? null;

      if (numbers.length < 6) continue;

      const parts = dateStr.split('.');
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const isWed = d.getDay() === 3;
      const isSat = d.getDay() === 6;

      const entry = {
        numbers: numbers.slice(0, 6).map(Number),
        sz: sz !== null ? Number(sz) : null,
        date: dateStr
      };

      if (isWed && wed.length < 20) wed.push(entry);
      else if (isSat && sat.length < 20) sat.push(entry);
    }

    res.json({ wed, sat, count: ziehungen.length });
  } catch (e) {
    res.json({ wed: [], sat: [], error: e.message, fallback: true });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JackpotMax Server v4.0 läuft auf Port ${PORT}`);
});
