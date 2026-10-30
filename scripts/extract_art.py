"""Cuts game art out of design/concept.webp (the supplied concept sheet).

Run from the project root:  python3 scripts/extract_art.py
Outputs to public/art/. Panels are upscaled 2x; baked-in dynamic content
(scores, counts, slider/toggle states) is inpainted away so the game can draw
live values in the same spots. Coordinates are concept-sheet pixels.
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter

SRC = 'design/concept.webp'
OUT = 'public/art'
SCALE = 2
os.makedirs(OUT, exist_ok=True)

sheet = cv2.cvtColor(cv2.imread(SRC, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)

PANELS = {
    'menu': (0, 0, 335, 815),
    'game': (349, 0, 691, 815),
    'over': (706, 0, 1021, 815),
    'collection': (12, 830, 351, 1246),
    'settings': (366, 830, 699, 1246),
    'howto': (713, 830, 1012, 1246),
}


def upscale(rgb: np.ndarray, factor: int = SCALE) -> Image.Image:
    im = Image.fromarray(rgb)
    im = im.resize((im.width * factor, im.height * factor), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))


def save(im: Image.Image, name: str, q: int = 88) -> None:
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)


def inpaint(img: np.ndarray, rects, mode='rect', radius=4):
    """rects in sheet coords. mode: rect (whole box), bright (text lighter than bg), dark."""
    mask = np.zeros(img.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in rects:
        if mode == 'rect':
            mask[y0:y1, x0:x1] = 255
        else:
            roi = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
            sel = roi > 120 if mode == 'bright' else roi < 110
            m = np.zeros_like(roi, np.uint8)
            m[sel] = 255
            m = cv2.dilate(m, np.ones((5, 5), np.uint8))
            mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], m)
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, mask, radius, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB)


def crop(img, box):
    x0, y0, x1, y1 = box
    return img[y0:y1, x0:x1].copy()


def keyed(box, lo=14, hi=70, factor=4) -> Image.Image:
    """Crop a sprite from the dark sheet background and convert background to alpha."""
    rgb = crop(sheet, box).astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    a = np.clip((dist - lo) / (hi - lo), 0, 1)
    a = a ** 0.85
    safe = np.maximum(a, 1e-3)[..., None]
    col = np.clip(bg + (rgb - bg) / safe, 0, 255)
    rgba = np.dstack([col, a * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    return im.resize((im.width * factor, im.height * factor), Image.LANCZOS)


# ---------------- Panels ----------------
work = sheet.copy()
# Gameplay HUD numbers + ability count
work = inpaint(work, [(361, 24, 424, 57), (551, 24, 624, 54)])
work = inpaint(work, [(659, 766, 682, 796)], mode='bright', radius=3)
# Game over: garbled "SOLRE" label, Q tail (QVER -> OVER), numbers, counts, NEW BEST stamp
stamp = crop(sheet, (901, 366, 985, 405))
work = inpaint(work, [(834, 320, 890, 343)])
tail = np.zeros(work.shape[:2], np.uint8)
yy, xx = np.mgrid[0:work.shape[0], 0:work.shape[1]]
outside_o = ((xx - 888) / 16.5) ** 2 + ((yy - 267) / 22.0) ** 2 > 1
tail[(xx >= 890) & (xx <= 907) & (yy >= 281) & (yy <= 294) & outside_o] = 255
work = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(work, cv2.COLOR_RGB2BGR), tail, 3, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
work = inpaint(work, [(826, 364, 896, 404), (832, 436, 898, 470)])
work = inpaint(work, [(758, 581, 976, 605)], mode='bright', radius=3)
work = inpaint(work, [(900, 365, 986, 406)], radius=6)
# Settings: sliders, toggles, "dark mode" row label + icon
tog_on = crop(sheet, (584, 996, 629, 1026))
tog_off = crop(sheet, (584, 1040, 629, 1070))
thumb = keyed((589, 903, 610, 924), factor=SCALE * 2)
work = inpaint(work, [(514, 900, 639, 926), (514, 944, 639, 971)], radius=5)
work = inpaint(work, [(582, 994, 631, 1028), (582, 1038, 631, 1072), (582, 1082, 631, 1115)], radius=5)
work = inpaint(work, [(406, 1083, 516, 1113)], radius=5)
# How to play: control description (rewritten for drag/keyboard controls)
work = inpaint(work, [(820, 1005, 973, 1043)], radius=5)
# ...and the 'avoid' line (walls now wrap, so it is rewritten live)
work = inpaint(work, [(822, 1141, 992, 1164)], radius=5)

for name, box in PANELS.items():
    save(upscale(crop(work, box)), f'panel-{name}', q=90)

save(upscale(stamp), 'new-best')
save(upscale(tog_on), 'toggle-on')
save(upscale(tog_off), 'toggle-off')
thumb.save(f'{OUT}/slider-thumb.webp', 'WEBP', quality=90)

# Blank buttons (text + icon removed) for extra actions in the same style
primary = inpaint(sheet.copy(), [(745, 656, 990, 700)], radius=6)
save(upscale(crop(primary, (727, 645, 1005, 711))), 'btn-primary')
secondary = inpaint(sheet.copy(), [(785, 735, 955, 771)], radius=6)
save(upscale(crop(secondary, (767, 725, 972, 781))), 'btn-secondary')

# Collection tabs (text removed, drawn live)
tabs = inpaint(sheet.copy(), [(36, 889, 93, 908), (114, 889, 174, 908)], radius=4)
save(upscale(crop(tabs, (28, 880, 101, 917))), 'tab-on')
save(upscale(crop(tabs, (108, 880, 180, 917))), 'tab-off')

# ---------------- Cards ----------------
COLS = [(28, 100), (108, 180), (188, 260), (267, 340)]
ROWS = [(922, 1022), (1030, 1131), (1137, 1238)]
def cell(r, c):
    return (COLS[c][0], ROWS[r][0], COLS[c][1], ROWS[r][1])

ART = {'dragon': (0, 0), 'sorcerer': (0, 1), 'keeper': (0, 3), 'warrior': (1, 0), 'jester': (2, 1), 'pharaoh': (2, 3)}
for name, (r, c) in ART.items():
    save(upscale(crop(sheet, cell(r, c)), 3), f'card-{name}', q=90)
save(upscale(crop(sheet, cell(0, 2)), 3), 'card-locked', q=90)

# ---------------- Sprites ----------------
SPRITES = {
    'head-up': (14, 1286, 104, 1377),
    'head-right': (106, 1292, 203, 1372),
    'head-down': (226, 1294, 284, 1377),
    'head-left': (305, 1297, 396, 1372),
    'body-strip': (396, 1304, 508, 1366),
    'tail': (520, 1297, 578, 1370),
    'puzzle': (615, 1281, 688, 1367),
    'monsterCard': (720, 1281, 783, 1370),
    'godCard': (822, 1279, 888, 1370),
    'millenniumEye': (917, 1289, 1000, 1370),
    'pillar': (207, 1440, 261, 1513),
    'column': (326, 1440, 391, 1515),
    'torch': (262, 1452, 304, 1516),
    'icon-dpad': (495, 1443, 558, 1505),
    'icon-pause': (560, 1443, 622, 1505),
    'icon-ability': (625, 1440, 693, 1510),
    'icon-heart': (695, 1440, 757, 1516),
    'fx-gold': (781, 1455, 842, 1518),
    'fx-blue': (853, 1455, 912, 1518),
    'fx-red': (918, 1455, 965, 1518),
    'fx-spark': (968, 1440, 1015, 1518),
}
sprites = {}
for name, box in SPRITES.items():
    im = keyed(box)
    sprites[name] = im
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=90)

# Floor tiles (opaque; tinted in the renderer to match the dark temple floor)
for i, box in enumerate([(19, 1447, 77, 1508), (82, 1447, 139, 1508), (143, 1447, 201, 1508)]):
    save(upscale(crop(sheet, box), 2), f'tile-{i}', q=90)

# Item cards: gold frame from an illustrated card, art window replaced by an item sprite
frame = upscale(crop(sheet, cell(0, 3)), 3).convert('RGBA')
fw, fh = frame.size
win = (int(fw * 0.12), int(fh * 0.1), int(fw * 0.88), int(fh * 0.84))
def item_card(sprite_name, name, tint=(30, 26, 60)):
    card = frame.copy()
    grad = Image.new('RGBA', (win[2] - win[0], win[3] - win[1]))
    gw, gh = grad.size
    arr = np.zeros((gh, gw, 4), np.uint8)
    yy, xx = np.mgrid[0:gh, 0:gw]
    d = np.sqrt(((xx - gw / 2) / gw) ** 2 + ((yy - gh / 2) / gh) ** 2)
    k = np.clip(1 - d * 1.6, 0, 1)[..., None]
    arr[..., :3] = (np.array([12, 11, 20]) * (1 - k) + np.array(tint) * k * 1.6).clip(0, 255)
    arr[..., 3] = 255
    card.alpha_composite(Image.fromarray(arr, 'RGBA'), (win[0], win[1]))
    sp = sprites[sprite_name]
    s = min(gw * 0.8 / sp.width, gh * 0.8 / sp.height)
    sp = sp.resize((int(sp.width * s), int(sp.height * s)), Image.LANCZOS)
    card.alpha_composite(sp, (win[0] + (gw - sp.width) // 2, win[1] + (gh - sp.height) // 2))
    card.convert('RGB').save(f'{OUT}/card-{name}.webp', 'WEBP', quality=90)

item_card('puzzle', 'puzzle', (90, 70, 20))
item_card('millenniumEye', 'eye', (40, 60, 110))
item_card('godCard', 'god', (110, 30, 30))
item_card('pillar', 'guardian', (60, 50, 40))
item_card('torch', 'flame', (110, 60, 20))
item_card('icon-heart', 'heart', (100, 25, 40))

print('art written to', OUT, len(os.listdir(OUT)), 'files')

# ---------------- Full-height filler: hieroglyph wall from the settings panel ----------------
wall = crop(sheet, (668, 878, 697, 1236))
wall = np.concatenate([wall, wall[::-1]], axis=0)  # mirror so it tiles vertically without a seam
wall = np.concatenate([wall, wall[:, ::-1]], axis=1)
save(upscale(wall), 'wall', q=85)
print('wall texture written')
