#!/usr/bin/env python3
"""Download full-res images for all cards ever played by Yugi/Atem (Duel Monsters anime)."""
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent
API = "https://db.ygoprodeck.com/api/v7/cardinfo.php"
IMG = "https://images.ygoprodeck.com/images/cards/{}.jpg"

with open(OUT / "cards.txt") as f:
    cards = [line.strip() for line in f if line.strip()]

headers = {"User-Agent": "Mozilla/5.0 (card downloader)"}
not_found, downloaded, skipped = [], [], 0

for name in cards:
    q = urllib.parse.quote(name)
    url = f"{API}?name={q}"
    success = False
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
            if not data.get("data"):
                not_found.append(name); break
            card = data["data"][0]
            cid = card["id"]
            fname = re.sub(r'[^\w\- ]', '', name).strip().replace(' ', '_')
            dest = OUT / f"{fname}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1  # already downloaded
                success = True
                break
            req2 = urllib.request.Request(IMG.format(cid), headers=headers)
            dest.write_bytes(urllib.request.urlopen(req2, timeout=30).read())
            downloaded.append(f"{fname}.jpg")
            print(f"OK  {name} (id {cid})")
            success = True
            break
        except urllib.error.HTTPError as e:
            not_found.append(name)
            print(f"ERR {name}: HTTP {e.code}")
            break
        except Exception as e:  # network flake
            print(f"RETRY {name} (attempt {attempt + 1}): {e}")
    if not success and not any(n == name for n in not_found):
        not_found.append(name)

print(f"\nDownloaded: {len(downloaded)}, skipped (existing): {skipped}, not found: {len(not_found)}")
if not_found:
    print("NOT FOUND:", ", ".join(not_found))
