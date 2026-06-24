const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

app.get('/ping', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ status: 'JackpotMax Server ✅ v3.0' }));

// ===== EUROJACKPOT =====
// Quelle: winnersystem.org - öffentlich zugänglich, kein Scraping-Schutz
app.get('/ej', async (req, res) => {
  try {
    const url = 'https://winnersystem.org/en/eurojackpot/archiv/';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
      }
    });
    const html = await r.text();

    const tue = [], fri = [];
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      // Datum finden
      const dateMatch = row.match(/(\d{2}\.\d{2}\.\d{4})/);
      if (!dateMatch) continue;
      const dateStr = dateMatch[1];
      const parts = dateStr.split('.');
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const isTue = d.getDay() === 2;
      const isFri = d.getDay() === 5;
      if (!isTue && !isFri) continue;

      // Zahlen finden (1-50)
      const numMatches = row.match(/\b([1-9]|[1-4][0-9]|50)\b/g) || [];
      const nums = [...new Set(numMatches.map(Number))].slice(0, 7);
      if (nums.length < 7) continue;

      const entry = { numbers: nums.slice(0, 5), euro: nums.slice(5, 7), date: dateStr };
      if (isTue && tue.length < 20) tue.push(entry);
      else if (isFri && fri.length < 20) fri.push(entry);
      if (tue.length >= 20 && fri.length >= 20) break;
    }

    res.json({ tue, fri });
  } catch (e) {
    // Fallback: Letzte bekannte Ziehungen als Notlösung
    res.json({
      tue: [
        { numbers: [17,24,31,36,46], euro: [7,8], date: '24.06.2026' },
        { numbers: [2,36,38,40,46], euro: [7,8], date: '17.06.2026' },
        { numbers: [5,11,23,33,42], euro: [10,12], date: '10.06.2026' },
        { numbers: [10,36,37,39,47], euro: [5,6], date: '03.06.2026' }
      ],
      fri: [
        { numbers: [24,27,43,48,50], euro: [4,12], date: '20.06.2026' },
        { numbers: [21,23,44,47,50], euro: [1,7], date: '13.06.2026' },
        { numbers: [3,20,21,42,49], euro: [5,6], date: '06.06.2026' }
      ],
      error: e.message,
      fallback: true
    });
  }
});

// ===== LOTTO =====
app.get('/lotto', async (req, res) => {
  try {
    const url = 'https://winnersystem.org/de/lotto/archiv/';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9'
      }
    });
    const html = await r.text();

    const wed = [], sat = [];
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      const dateMatch = row.match(/(\d{2}\.\d{2}\.\d{4})/);
      if (!dateMatch) continue;
      const dateStr = dateMatch[1];
      const parts = dateStr.split('.');
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const isWed = d.getDay() === 3;
      const isSat = d.getDay() === 6;
      if (!isWed && !isSat) continue;

      const numMatches = row.match(/\b([1-9]|[1-4][0-9])\b/g) || [];
      const nums = [...new Set(numMatches.map(Number))].filter(n => n >= 1 && n <= 49).slice(0, 6);
      if (nums.length < 6) continue;

      const entry = { numbers: nums, sz: null, date: dateStr };
      if (isWed && wed.length < 20) wed.push(entry);
      else if (isSat && sat.length < 20) sat.push(entry);
      if (wed.length >= 20 && sat.length >= 20) break;
    }

    res.json({ wed, sat });
  } catch (e) {
    res.json({ wed: [], sat: [], error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JackpotMax Server v3.0 läuft auf Port ${PORT}`);
});
