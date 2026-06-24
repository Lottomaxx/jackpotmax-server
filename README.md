# JackpotMax Server

Proxy-Server für JackpotMax App — holt EuroJackpot und Lotto 6aus49 Ziehungen.

## Endpunkte
- GET /ping — Server-Status
- GET /ej   — EuroJackpot letzte 20 Ziehungen (Di + Fr)
- GET /lotto — Lotto 6aus49 letzte 20 Ziehungen (Mi + Sa)

## Deploy auf Render.com
1. Dieses Repository auf GitHub hochladen
2. Auf render.com "New Web Service" erstellen
3. GitHub Repository verbinden
4. Build Command: npm install
5. Start Command: node server.js
6. Fertig!
