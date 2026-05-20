# Security Backlog (ZenPost PWA + API)

Stand: 2026-05-20

## Ziel
Solide Session-Sicherheit ohne harte UX-Brueche (kein erzwungener Logout bei jedem Browser-Schliessen).

## Aktuelle Entscheidung
- `localStorage` fuer Session-Token bleibt vorerst aktiv (bessere UX).
- Sicherheit wird serverseitig ueber Session-Lebensdauer und Invalidierung gehaertet.

## Priorisierte Umsetzung

1. Session Expiry (Server)
- In `user_sessions` ein `expires_at` Feld nutzen/einfuehren.
- Hartes Session-Limit setzen (Vorschlag: 30 Tage).
- Abgelaufene Tokens in `auth.php` als ungueltig behandeln.

2. Idle Timeout (Server)
- `last_seen_at` Feld in `user_sessions` nutzen/einfuehren.
- Inaktivitaetsgrenze setzen (Vorschlag: 7 Tage).
- Bei jeder gueltigen API-Nutzung `last_seen_at` aktualisieren.

3. Logout API
- `logout_api.php` erstellen.
- Aktuelles Token serverseitig loeschen/invalidieren.
- Client soll Logout immer ueber API + lokales Clear ausfuehren.

4. CORS einschraenken
- `Access-Control-Allow-Origin: *` ersetzen.
- Nur bekannte Origins erlauben (z. B. `https://zenpost.denisbitter.de`, `https://zenpostpocket.denisbitter.de`).
- Preflight/Headers konsistent halten.

5. Optional spaeter: Session-Management
- "Alle anderen Geraete abmelden" Endpoint.
- Aktive Sessions pro User anzeigen (Zeitpunkt, optional User-Agent/IP-Hash).

## Validierungs-Checkliste
- Token nur lokal pro Browser/Profil gespeichert.
- Jeder Daten-Endpoint strikt mit `user_id` abgesichert.
- Abgelaufene/idle Sessions werden serverseitig abgewiesen.
- Logout invalidiert Token auch serverseitig.
- CORS nur fuer freigegebene Origins offen.

## Notizen
- `sessionStorage` statt `localStorage` bleibt optional, ist aber aktuell bewusst nicht gesetzt (UX-Grund).
