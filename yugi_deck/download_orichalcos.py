#!/usr/bin/env python3
"""Download all versions of The Seal of Orichalcos from Yugipedia."""
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "orichalcos_versions"
OUT.mkdir(exist_ok=True)

FILES = [
    # Main anime card versions
    "TheSealofOrichalcos-EN-Anime-DM",
    "TheSealofOrichalcos-JP-Anime-DM",
    "TheSealofOrichalcos-JP-Anime-DM-Gurimo",
    "TheSealofOrichalcos-JP-Anime-DM-Pegasus",
    "TheSealofOrichalcos-JP-Anime-DM-Rex",
    "TheSealofOrichalcos-JP-Anime-DM-Weevil",
    "TheSealofOrichalcos-JP-Anime-DM-Prisoners",
    "TheSealofOrichalcos-JP-Anime-DM-Prisoners-2",
    "TheSealofOrichalcos-JP-Anime-DM-Prisoners-3",
    "TheSealofOrichalcos-JP-Anime-DM-Prisoners-4",
    "TheSealofOrichalcos-JP-Anime-DM-NC",
    # Official TCG promo color variants (blue / green / purple + base)
    "TheSealofOrichalcos-DLCS-EN-UR-1E",
    "TheSealofOrichalcos-DLCS-EN-UR-1E-Blue",
    "TheSealofOrichalcos-DLCS-EN-UR-1E-Green",
    "TheSealofOrichalcos-DLCS-EN-UR-1E-Purple",
    "TheSealofOrichalcos-DRL3-EN-UR-1E",
    "TheSealofOrichalcos-22RC-SC-OP",
    # Video game versions
    "TheSealofOrichalcos-DAR-EN-VG",
    "TheSealofOrichalcos-DAR-EN-VG-Field",
    "TheSealofOrichalcos-DG-EN-VG-Field",
    # Other printings
    "TheSealofOrichalcos-EP12-JP-UR",
    "TheSealofOrichalcos-EXP5-KR-UR-1E",
    "TheSealofOrichalcos-LC03-EN-LE-OP",
]

headers = {"User-Agent": "Mozilla/5.0 (card downloader)"}
done, failed = 0, []
for base in FILES:
    for ext in ("png", "jpg"):
        url = f"https://ms.yugipedia.com/.../{base}.{ext}"  # resolved via API below
        break
    # get real URL from API
    try:
        req = urllib.request.Request(
            f"https://yugipedia.com/api.php?action=query&titles=File:{base}.png"
            "&prop=imageinfo&iiprop=url&format=json", headers=headers)
        import json
        d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        pages = d["query"]["pages"]
        page = next(iter(pages.values()))
        ext = "png"
        if "missing" in page:
            req = urllib.request.Request(
                f"https://yugipedia.com/api.php?action=query&titles=File:{base}.jpg"
                "&prop=imageinfo&iiprop=url&format=json", headers=headers)
            d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
            pages = d["query"]["pages"]
            page = next(iter(pages.values()))
            ext = "jpg"
        if "missing" in page or "imageinfo" not in page:
            failed.append(base); continue
        url = page["imageinfo"][0]["url"]
        data = urllib.request.urlopen(
            urllib.request.Request(url, headers=headers), timeout=30).read()
        (OUT / f"{base}.{ext}").write_bytes(data)
        done += 1
        print(f"OK  {base}.{ext} ({len(data)//1024} KB)")
    except Exception as e:
        print(f"ERR {base}: {e}")
        failed.append(base)

print(f"\nDone: {done}, failed: {len(failed)}")
if failed:
    print("FAILED:", ", ".join(failed))
