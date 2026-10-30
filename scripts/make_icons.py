"""App icon: the glowing Millennium Puzzle from the menu art, set in a gold medallion.

Run from the project root:  python3 scripts/make_icons.py
Writes the master (design/icon-1024.png), PWA icons (public/icons/), the favicon,
and Android launcher icons (legacy, round and adaptive layers).
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SHEET = Image.open('design/concept.webp').convert('RGB')
N = 1024
GOLD_L, GOLD, GOLD_D = (246, 216, 130), (214, 168, 61), (100, 68, 14)


def background(size=N) -> Image.Image:
    """Full-bleed backdrop: the menu's magic sky around the puzzle, blurred into a soft glow."""
    sky = SHEET.crop((0, 250, 335, 585)).resize((size, size), Image.LANCZOS)
    sky = sky.filter(ImageFilter.GaussianBlur(size * 0.03))
    a = np.asarray(sky).astype(np.float32) * 0.45 + np.array([42, 30, 92]) * 0.55   # pull toward Millennium purple
    yy, xx = np.mgrid[0:size, 0:size] / size
    d = np.sqrt((xx - 0.5) ** 2 + (yy - 0.47) ** 2)
    k = np.clip(d / 0.72, 0, 1)[..., None]
    a = a * (1 - k) + np.array([16, 12, 30]) * k            # vignette to obsidian
    glow = np.clip(1 - d / 0.42, 0, 1)[..., None] ** 2
    a = a + glow * np.array([40, 70, 140])                    # blue bloom behind the medallion
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def medallion(size=N, r_outer=392) -> Image.Image:
    """Transparent layer: puzzle art in a circle, framed by a bevelled gold ring with studs."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c = size / 2
    r_in = int(r_outer * 0.86)

    # puzzle art (centre of the menu's Millennium Puzzle, circular, soft edge)
    cx, cy, cr = 170, 408, 68
    art = SHEET.crop((cx - cr, cy - cr, cx + cr, cy + cr)).resize((r_in * 2, r_in * 2), Image.LANCZOS)
    art = art.filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    mask = Image.new('L', art.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, art.width - 1, art.height - 1), fill=255)
    layer.paste(art, (int(c - r_in), int(c - r_in)), mask.filter(ImageFilter.GaussianBlur(2)))

    # outer blue aura
    aura = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ad = ImageDraw.Draw(aura)
    ad.ellipse((c - r_outer - 26, c - r_outer - 26, c + r_outer + 26, c + r_outer + 26), outline=(90, 170, 255, 170), width=26)
    aura = aura.filter(ImageFilter.GaussianBlur(18))
    out = Image.alpha_composite(aura, layer)

    # gold ring: vertical gradient clipped to the annulus
    ring_mask = Image.new('L', (size, size), 0)
    rm = ImageDraw.Draw(ring_mask)
    rm.ellipse((c - r_outer, c - r_outer, c + r_outer, c + r_outer), fill=255)
    rm.ellipse((c - r_in, c - r_in, c + r_in, c + r_in), fill=0)
    grad = np.zeros((size, size, 4), np.uint8)
    t = np.linspace(0, 1, size)[:, None]
    for i, (a0, a1, a2) in enumerate(zip(GOLD_L, GOLD, GOLD_D)):
        grad[..., i] = np.where(t < 0.5, a0 + (a1 - a0) * t * 2, a1 + (a2 - a1) * (t - 0.5) * 2)
    grad[..., 3] = 255
    out.paste(Image.fromarray(grad, 'RGBA'), (0, 0), ring_mask)

    d = ImageDraw.Draw(out)
    for rr, col, w in [(r_outer, (52, 34, 6, 255), 6), (r_in, (40, 26, 4, 255), 6),
                       ((r_outer + r_in) / 2, (255, 236, 170, 120), 3)]:
        d.ellipse((c - rr, c - rr, c + rr, c + rr), outline=col, width=w)
    # four diamond studs (like the game's buttons) and fine notches
    rm_mid = (r_outer + r_in) / 2
    for ang in range(0, 360, 15):
        a = np.radians(ang)
        if ang % 90 == 0:
            s = (r_outer - r_in) * 0.62
            px, py = c + np.cos(a) * rm_mid, c + np.sin(a) * rm_mid
            d.polygon([(px, py - s), (px + s, py), (px, py + s), (px - s, py)], fill=(57, 140, 203, 255), outline=(30, 20, 4, 255))
            d.polygon([(px, py - s * 0.45), (px + s * 0.45, py), (px, py + s * 0.45), (px - s * 0.45, py)], fill=(190, 230, 255, 255))
        else:
            x0, y0 = c + np.cos(a) * (r_in + 8), c + np.sin(a) * (r_in + 8)
            x1, y1 = c + np.cos(a) * (r_outer - 8), c + np.sin(a) * (r_outer - 8)
            d.line((x0, y0, x1, y1), fill=(110, 76, 18, 200), width=4)
    return out


def full_icon(scale=1.0) -> Image.Image:
    bg = background().convert('RGBA')
    med = medallion(r_outer=int(392 * scale))
    return Image.alpha_composite(bg, med).convert('RGB')


def save(im: Image.Image, path: str, size: int) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize((size, size), Image.LANCZOS).save(path)


def main():
    master = full_icon()
    os.makedirs('design', exist_ok=True)
    master.save('design/icon-1024.png')

    # PWA / web
    save(master, 'public/icons/icon-512.png', 512)
    save(master, 'public/icons/icon-192.png', 192)
    save(master, 'public/icons/apple-touch-icon.png', 180)
    save(master, 'public/favicon.png', 64)
    save(full_icon(scale=0.86), 'public/icons/icon-maskable-512.png', 512)  # stays inside the 80% safe zone

    # Android: legacy square + round, and adaptive foreground/background (108dp, 66dp safe circle)
    res = 'android/app/src/main/res'
    round_mask = Image.new('L', (N, N), 0)
    ImageDraw.Draw(round_mask).ellipse((0, 0, N - 1, N - 1), fill=255)
    rounded = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    rounded.paste(master, (0, 0), round_mask)
    fg = medallion(r_outer=int(N * 0.285))
    bg = background()
    for dpi, legacy, adaptive in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
        save(master, f'{res}/mipmap-{dpi}/ic_launcher.png', legacy)
        save(rounded, f'{res}/mipmap-{dpi}/ic_launcher_round.png', legacy)
        save(fg, f'{res}/mipmap-{dpi}/ic_launcher_foreground.png', adaptive)
        save(bg, f'{res}/mipmap-{dpi}/ic_launcher_background.png', adaptive)
    print('icons written')


main()
