#!/usr/bin/env python3
"""
Google Search Console — URL Re-Indexer
Liest URLs aus sitemap.xml und meldet sie via Google Indexing API neu an.

Lokal (OAuth Desktop App):
  python gsc_reindex.py --site https://zenpost.denisbitter.de

CI/GitHub Actions (Service Account):
  export GOOGLE_SA_JSON='{"type":"service_account",...}'
  python gsc_reindex.py --site https://zenpost.denisbitter.de

Quota: 200 URLs/Tag (Google Limit)
"""

import argparse
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

try:
    import requests
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request as GoogleRequest
except ImportError:
    print("Fehlende Abhängigkeiten. Bitte ausführen:")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# ── Konfiguration ──────────────────────────────────────────────
SCOPES        = ['https://www.googleapis.com/auth/indexing']
INDEXING_API  = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
QUOTA_PER_DAY = 200
REQUEST_DELAY = 1.1   # Sekunden zwischen Requests (Quota: 600/min)

SITES = [
    'https://zenpost.denisbitter.de',
    'https://zenpostpocket.denisbitter.de',
    'https://zenorbit.denisbitter.de',
]


# ── Auth ───────────────────────────────────────────────────────
def get_sa_credentials() -> service_account.Credentials | None:
    """Service Account aus GOOGLE_SA_JSON Env-Var (für CI/GitHub Actions)."""
    sa_json = os.environ.get('GOOGLE_SA_JSON')
    if not sa_json:
        return None
    try:
        sa_info = json.loads(sa_json)
        return service_account.Credentials.from_service_account_info(
            sa_info, scopes=SCOPES)
    except Exception as e:
        print(f"FEHLER beim Laden des Service Accounts: {e}")
        sys.exit(1)


def get_credentials(credentials_file: str, token_file: str) -> Credentials:
    creds = None

    if Path(token_file).exists():
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        else:
            if not Path(credentials_file).exists():
                print(f"\nFEHLER: '{credentials_file}' nicht gefunden.")
                print("Bitte aus Google Cloud Console herunterladen:")
                print("  APIs & Services → Credentials → OAuth 2.0 Client-ID (Desktop App)")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
            creds = flow.run_local_server(port=0, prompt='consent')

        Path(token_file).write_text(creds.to_json())
        print(f"Token gespeichert: {token_file}")

    return creds


# ── Sitemap ────────────────────────────────────────────────────
def fetch_urls(sitemap_url: str) -> list[str]:
    try:
        r = requests.get(sitemap_url, timeout=15)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"  ✗ Sitemap nicht erreichbar: {e}")
        return []

    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError as e:
        print(f"  ✗ Sitemap XML-Fehler: {e}")
        return []

    # Sitemap-Index → rekursiv laden
    sub_sitemaps = root.findall('sm:sitemap', ns)
    if sub_sitemaps:
        urls = []
        for sm in sub_sitemaps:
            loc = sm.find('sm:loc', ns)
            if loc is not None:
                print(f"  → Sub-Sitemap: {loc.text}")
                urls.extend(fetch_urls(loc.text))
        return urls

    # Direkte URL-Liste
    return [
        loc.text for url_el in root.findall('sm:url', ns)
        if (loc := url_el.find('sm:loc', ns)) is not None and loc.text
    ]


# ── Indexing API ───────────────────────────────────────────────
def submit_url(url: str, creds: Credentials, notification_type: str) -> tuple[int, dict]:
    if creds.expired:
        creds.refresh(GoogleRequest())

    resp = requests.post(
        INDEXING_API,
        headers={
            'Authorization': f'Bearer {creds.token}',
            'Content-Type': 'application/json',
        },
        json={'url': url, 'type': notification_type},
        timeout=15,
    )
    return resp.status_code, (resp.json() if resp.content else {})


# ── Main ───────────────────────────────────────────────────────
def run(site: str, creds: Credentials, notification_type: str, limit: int, dry_run: bool) -> dict:
    sitemap_url = site.rstrip('/') + '/sitemap.xml'
    print(f"\nSitemap: {sitemap_url}")

    urls = fetch_urls(sitemap_url)
    if not urls:
        print("  Keine URLs gefunden.")
        return {'site': site, 'total': 0, 'success': 0, 'errors': []}

    urls = urls[:limit]
    print(f"  {len(urls)} URL(s) geladen")

    if dry_run:
        for u in urls:
            print(f"  [DRY] {u}")
        return {'site': site, 'total': len(urls), 'success': 0, 'errors': [], 'dry_run': True}

    ok, errors = [], []
    for i, url in enumerate(urls, 1):
        status, body = submit_url(url, creds, notification_type)
        icon = '✓' if status == 200 else '✗'
        print(f"  [{i:>3}/{len(urls)}] {icon} HTTP {status}  {url}")

        if status == 200:
            ok.append(url)
        else:
            msg = body.get('error', {}).get('message', json.dumps(body))
            print(f"           → {msg}")
            errors.append({'url': url, 'status': status, 'error': msg})

        if i < len(urls):
            time.sleep(REQUEST_DELAY)

    return {'site': site, 'total': len(urls), 'success': len(ok), 'errors': errors}


def main():
    parser = argparse.ArgumentParser(
        description='Google Indexing API — Re-Indexer für Denis Bitter Sites',
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        '--site', nargs='+',
        help=f'Site-URL(s). Default: alle konfigurierten Sites\n{chr(10).join(f"  {s}" for s in SITES)}',
    )
    parser.add_argument('--credentials', default='credentials.json',
        help='Pfad zur credentials.json (OAuth Desktop App) [default: credentials.json]')
    parser.add_argument('--token', default='token.json',
        help='Pfad zum Token-Cache [default: token.json]')
    parser.add_argument('--type', default='URL_UPDATED',
        choices=['URL_UPDATED', 'URL_DELETED'],
        help='Notification type [default: URL_UPDATED]')
    parser.add_argument('--limit', type=int, default=QUOTA_PER_DAY,
        help=f'Max URLs pro Site (Tages-Quota: {QUOTA_PER_DAY}) [default: {QUOTA_PER_DAY}]')
    parser.add_argument('--dry-run', action='store_true',
        help='URLs nur anzeigen, nichts senden')
    args = parser.parse_args()

    target_sites = args.site or SITES

    print(f"\n{'═'*54}")
    print(f"  Google Indexing API — Re-Indexer")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Modus: {'DRY-RUN' if args.dry_run else args.type}")
    print(f"  Sites: {len(target_sites)}")
    print(f"{'═'*54}")

    # Auth: Service Account (CI) hat Vorrang vor OAuth (lokal)
    creds = get_sa_credentials() or get_credentials(args.credentials, args.token)
    if isinstance(creds, service_account.Credentials):
        print("  Auth: Service Account (CI-Modus)")
    else:
        print("  Auth: OAuth Desktop App (lokal)")

    all_results = []
    for site in target_sites:
        result = run(site, creds, args.type, args.limit, args.dry_run)
        all_results.append(result)

    # Zusammenfassung
    total   = sum(r['total']   for r in all_results)
    success = sum(r['success'] for r in all_results)
    errors  = sum(len(r['errors']) for r in all_results)

    print(f"\n{'═'*54}")
    print(f"  Fertig │ {total} URLs │ {success} ✓ │ {errors} ✗")
    print(f"{'═'*54}")

    # Log
    if not args.dry_run:
        log_path = Path(f"reindex_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        log_path.write_text(json.dumps({
            'timestamp': datetime.now().isoformat(),
            'type': args.type,
            'results': all_results,
        }, indent=2, ensure_ascii=False))
        print(f"  Log: {log_path}\n")


if __name__ == '__main__':
    main()
