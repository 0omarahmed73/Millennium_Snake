"""Re-frames the card scans in yugi_deck/ in the game's own card style.

Run from the project root:  python3 scripts/build_cards.py
Reads  yugi_deck/*.jpg and the Seal of Orichalcos card,
writes public/cards/<id>.webp and src/services/deck.generated.ts.
Needs Pillow + fontTools (to convert the bundled Cinzel woff2 to TTF).
"""
import colorsys
import io
import json
import os
import re
from glob import glob

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DECK = 'yugi_deck'
OUT = 'public/cards'
TS_OUT = 'src/services/deck.generated.ts'
FONT_DIR = 'node_modules/@fontsource/cinzel/files'
W, H = 600, 834          # drawn at 2x, saved at half size (300x417, same aspect as the collection grid cells)
ART = (44, 104, 556, 616)  # square art window

GOLD_L, GOLD, GOLD_D = (243, 210, 122), (214, 168, 61), (110, 76, 18)
OBSIDIAN = (23, 21, 34)

TYPE_COLOR = {
    'normal': (222, 178, 92), 'effect': (214, 120, 52), 'fusion': (150, 92, 200), 'ritual': (80, 130, 210),
    'spell': (40, 170, 150), 'trap': (190, 70, 140), 'god': (230, 70, 60), 'field': (70, 200, 110),
}
TYPE_LABEL = {
    'normal': 'Normal Monster', 'effect': 'Effect Monster', 'fusion': 'Fusion Monster', 'ritual': 'Ritual Monster',
    'spell': 'Spell Card', 'trap': 'Trap Card', 'god': 'Egyptian God', 'field': 'Field Spell',
}
RARITY_PIPS = {'common': 1, 'rare': 2, 'epic': 3, 'legendary': 4}
RARITY_COLOR = {'common': (203, 185, 143), 'rare': (79, 166, 255), 'epic': (180, 140, 255), 'legendary': GOLD_L}

NAME_FIX = {'Jacks Knight': "Jack's Knight", 'Kings Knight': "King's Knight", 'Queens Knight': "Queen's Knight",
            'Alpha The Magnet Warrior': 'Alpha the Magnet Warrior', 'Beta The Magnet Warrior': 'Beta the Magnet Warrior',
            'Gamma The Magnet Warrior': 'Gamma the Magnet Warrior'}
GODS = {'Obelisk_the_Tormentor', 'Slifer_the_Sky_Dragon', 'The_Winged_Dragon_of_Ra'}
ACES = {'Dark_Magician', 'Dark_Magician_Girl', 'Buster_Blader', 'Gandora_the_Dragon_of_Destruction', 'Valkyrion_the_Magna_Warrior',
        'Silent_Magician', 'Silent_Magician_Zero', 'Silent_Swordsman_LV5', 'Summoned_Skull', 'Mirror_Force', 'Monster_Reborn',
        'Pot_of_Greed', 'Polymerization', 'Swords_of_Revealing_Light'}


def ttf(weight: int, size: int) -> ImageFont.FreeTypeFont:
    path = f'/tmp/cinzel-{weight}.ttf'
    if not os.path.exists(path):
        f = TTFont(f'{FONT_DIR}/cinzel-latin-{weight}-normal.woff2')
        f.flavor = None
        f.save(path)
    return ImageFont.truetype(path, size)


def classify(im: Image.Image) -> str:
    """Card frame colour -> card type (sampled from the left border)."""
    strip = im.crop((14, 320, 40, 900)).resize((1, 1), Image.BOX).getpixel((0, 0))
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in strip))
    h *= 360
    if 150 <= h <= 200 and s > 0.2: return 'spell'
    if 290 <= h <= 345: return 'trap'
    if 250 <= h < 290: return 'fusion'
    if 200 < h < 250: return 'ritual'
    return 'normal' if h >= 26 else 'effect'


def gradient(size, top, bottom):
    g = Image.new('RGB', (1, 256))
    for y in range(256):
        t = y / 255
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize(size)


def gold_rect(card, box, radius, width):
    """Bevelled gold frame: bright top edge, darker bottom, thin dark keylines."""
    x0, y0, x1, y1 = box
    mask = Image.new('L', card.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle(box, radius, fill=255)
    md.rounded_rectangle((x0 + width, y0 + width, x1 - width, y1 - width), max(0, radius - width), fill=0)
    gold = gradient((x1 - x0, y1 - y0), GOLD_L, GOLD_D)
    layer = Image.new('RGB', card.size)
    layer.paste(gold, (x0, y0))
    card.paste(layer, (0, 0), mask)
    d = ImageDraw.Draw(card)
    d.rounded_rectangle(box, radius, outline=(58, 38, 8), width=2)
    d.rounded_rectangle((x0 + width, y0 + width, x1 - width, y1 - width), max(0, radius - width), outline=(40, 26, 6), width=2)


def diamond(d, cx, cy, r, fill, outline=(58, 38, 8)):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill, outline=outline)


def fit_text(d, text, font_w, max_w, start):
    size = start
    while size > 14:
        f = ttf(font_w, size)
        if d.textlength(text, font=f) <= max_w: return f
        size -= 1
    return ttf(font_w, 14)


def build(src: Image.Image, art_box, name, ctype, rarity) -> Image.Image:
    accent = TYPE_COLOR[ctype]
    card = gradient((W, H), (34, 28, 58), (12, 10, 20))
    d = ImageDraw.Draw(card)

    # outer frame + corner gems
    gold_rect(card, (0, 0, W - 1, H - 1), 28, 16)
    d.rounded_rectangle((22, 22, W - 23, H - 23), 16, outline=(*GOLD_D,), width=2)
    for cx, cy in [(26, 26), (W - 27, 26), (26, H - 27), (W - 27, H - 27)]:
        diamond(d, cx, cy, 13, GOLD_L)

    # name plate
    plate = (34, 32, W - 35, 92)
    d.rounded_rectangle(plate, 8, fill=(16, 14, 26), outline=GOLD, width=3)
    d.line((48, 86, W - 49, 86), fill=(*accent,), width=2)
    gem_c = (W - 70, 62)
    d.ellipse((gem_c[0] - 20, gem_c[1] - 20, gem_c[0] + 20, gem_c[1] + 20), fill=accent, outline=GOLD_L, width=3)
    d.ellipse((gem_c[0] - 9, gem_c[1] - 12, gem_c[0] + 1, gem_c[1] - 3), fill=(255, 255, 255))
    f = fit_text(d, name.upper(), 700, W - 160, 34)
    d.text((54, 62), name.upper(), font=f, fill=GOLD_L, anchor='lm', stroke_width=2, stroke_fill=(30, 20, 4))

    # art window: accent keyline, gold border, artwork, inner shadow
    x0, y0, x1, y1 = ART
    d.rectangle((x0 - 12, y0 - 12, x1 + 12, y1 + 12), fill=accent)
    gold_rect(card, (x0 - 9, y0 - 9, x1 + 9, y1 + 9), 4, 9)
    art = src.crop(art_box).resize((x1 - x0, y1 - y0), Image.LANCZOS)
    card.paste(art, (x0, y0))
    shade = Image.new('L', (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(shade).rectangle((0, 0, x1 - x0 - 1, y1 - y0 - 1), outline=150, width=10)
    shade = shade.filter(ImageFilter.GaussianBlur(8))
    card.paste((0, 0, 0), (x0, y0), shade)

    # type ribbon
    rib = (70, 636, W - 71, 684)
    d.rounded_rectangle(rib, 22, fill=(16, 14, 26), outline=accent, width=3)
    lab = f'[ {TYPE_LABEL[ctype]} ]'.upper()
    d.text((W / 2, 660), lab, font=fit_text(d, lab, 700, rib[2] - rib[0] - 40, 24), fill=(235, 228, 210), anchor='mm')

    # bottom plate: eye of the millennium items + rarity pips
    bot = (34, 700, W - 35, 798)
    d.rounded_rectangle(bot, 10, fill=(16, 14, 26), outline=GOLD, width=3)
    cx, cy = W / 2, 735
    d.polygon([(cx - 46, cy), (cx, cy - 20), (cx + 46, cy), (cx, cy + 20)], fill=None, outline=GOLD, width=3)
    d.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill=(57, 140, 203), outline=GOLD_L, width=3)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(10, 10, 20))
    for side in (-1, 1):
        d.line((cx + side * 60, cy, cx + side * 200, cy), fill=GOLD_D, width=2)
    pips = RARITY_PIPS[rarity]
    for i in range(pips):
        diamond(d, W / 2 + (i - (pips - 1) / 2) * 34, 775, 10, RARITY_COLOR[rarity])

    return card.resize((W // 2, H // 2), Image.LANCZOS)


def card_id(stem: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-')


def main():
    os.makedirs(OUT, exist_ok=True)
    entries = []
    for path in sorted(glob(f'{DECK}/*.jpg')):
        stem = os.path.splitext(os.path.basename(path))[0]
        src = Image.open(path).convert('RGB')
        sx, sy = src.width / 813, src.height / 1185
        art_box = tuple(int(v * s) for v, s in zip((102, 221, 713, 832), (sx, sy, sx, sy)))
        name = NAME_FIX.get(stem.replace('_', ' '), stem.replace('_', ' '))
        ctype = 'god' if stem in GODS else classify(src)
        rarity = ('legendary' if ctype == 'god' else 'epic' if stem in ACES or ctype == 'fusion'
                  else 'rare' if ctype in ('spell', 'trap') else 'common')
        cid = card_id(stem)
        build(src, art_box, name, ctype, rarity).save(f'{OUT}/{cid}.webp', 'WEBP', quality=86, method=6)
        entries.append({'id': cid, 'name': name, 'type': ctype, 'rarity': rarity})

    # The Seal of Orichalcos (collected in-game as a special item)
    seal = Image.open(f'{DECK}/orichalcos_versions/TheSealofOrichalcos-DRL3-EN-UR-1E.png').convert('RGB')
    sx, sy = seal.width / 813, seal.height / 1185
    art_box = tuple(int(v * s) for v, s in zip((102, 221, 713, 832), (sx, sy, sx, sy)))
    build(seal, art_box, 'The Seal of Orichalcos', 'field', 'legendary').save(f'{OUT}/the-seal-of-orichalcos.webp', 'WEBP', quality=86, method=6)
    entries.append({'id': 'the-seal-of-orichalcos', 'name': 'The Seal of Orichalcos', 'type': 'field', 'rarity': 'legendary'})

    with open(TS_OUT, 'w') as fh:
        fh.write('// Generated by scripts/build_cards.py — do not edit by hand.\n')
        fh.write("export type DeckCardType = 'normal' | 'effect' | 'fusion' | 'ritual' | 'spell' | 'trap' | 'god' | 'field';\n")
        fh.write("export interface DeckCard { id: string; name: string; type: DeckCardType; rarity: 'common' | 'rare' | 'epic' | 'legendary' }\n\n")
        fh.write('export const DECK: DeckCard[] = ' + json.dumps(entries, indent=2) + ';\n')
    print(len(entries), 'cards ->', OUT)
    print({t: sum(1 for e in entries if e['type'] == t) for t in TYPE_COLOR})


main()


def seal_sprite():
    """In-game pickup: the green seal lines keyed out of the field art (green-dominant pixels only)."""
    import numpy as np
    src = Image.open(f'{DECK}/orichalcos_versions/TheSealofOrichalcos-DG-EN-VG-Field.png').convert('RGB')
    a = np.asarray(src).astype(np.float32)
    green = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((green - 18) / 70, 0, 1)
    rgb = np.clip(a * 1.15 + np.array([0, 20, 0]), 0, 255)
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    out.resize((256, 256), Image.LANCZOS).save('public/art/seal.webp', 'WEBP', quality=90)
    print('seal sprite written')


seal_sprite()
