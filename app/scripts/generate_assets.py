"""
Hunch App Icon & Splash Asset Generator
Generates all required Expo/EAS image assets programmatically using Pillow.

Design language:
  - Deep charcoal background (#1A1A1A) for icon
  - Warm off-white (#F5F0E8) for splash background
  - Stylised 'h' lettermark: geometric, two vertical strokes connected by an arch,
    with the right stroke continuing up into a small filled circle (the "hunch" dot)
  - Warm white lettermark #F5F0E8 on dark, dark on light
  - Gold accent dot #E8D5A3
"""

import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
os.makedirs(OUT_DIR, exist_ok=True)

def path(name):
    return os.path.join(OUT_DIR, name)


# ── Colour palette ───────────────────────────────────────────────────────────
BG_DARK    = (26,  26,  26,  255)   # #1A1A1A  – icon background
BG_LIGHT   = (250, 248, 245, 255)   # #FAF8F5  – splash / android bg
MARK_LIGHT = (245, 240, 232, 255)   # #F5F0E8  – mark on dark bg
MARK_DARK  = (26,  26,  26,  255)   # #1A1A1A  – mark on light bg
GOLD       = (232, 213, 163, 255)   # #E8D5A3  – accent dot
WHITE      = (255, 255, 255, 255)   # monochrome layer
TRANSPARENT = (0,  0,   0,  0)


# ── Drawing helpers ──────────────────────────────────────────────────────────

def draw_hunch_mark(draw: ImageDraw.ImageDraw, cx: float, cy: float,
                    size: float, stroke_color: tuple, dot_color: tuple):
    """
    Draw the 'h' lettermark centred at (cx, cy) within a square of `size`.

    Geometry (all in relative units, then scaled):
      Left vertical bar:  x=0.28, top=0.18, bottom=0.82
      Right vertical bar: x=0.58, top=0.46 (arch join), bottom=0.82
      Arch: ellipse connecting bars from y≈0.42 to y≈0.46, x 0.28–0.58
      Right bar continues up: x=0.58, from y≈0.42 up to y=0.14 (the "stem")
      Dot: circle at x=0.58, y≈0.10, radius=0.055
    
    Stroke width: size * 0.09
    """
    sw = max(2, int(size * 0.088))   # stroke width
    r  = sw / 2

    # Coordinate helpers (relative → absolute pixel)
    def px(rel_x): return cx - size / 2 + rel_x * size
    def py(rel_y): return cy - size / 2 + rel_y * size

    # Key x positions
    lx = 0.28   # left bar x-centre
    rx = 0.58   # right bar x-centre

    # Key y positions
    top_l  = 0.18   # top of left bar
    bot    = 0.82   # bottom of both bars
    arch_t = 0.395  # top of arch / right bar start (arch peak)
    arch_b = 0.475  # bottom of arch / right bar join
    stem_t = 0.145  # top of right vertical stem above arch
    dot_cy = 0.085  # centre of accent dot
    dot_r  = 0.052  # dot radius

    # 1. Left vertical bar
    draw.rounded_rectangle(
        [px(lx) - r, py(top_l), px(lx) + r, py(bot)],
        radius=r, fill=stroke_color
    )

    # 2. Right vertical bar (below arch only: arch_b → bot)
    draw.rounded_rectangle(
        [px(rx) - r, py(arch_b), px(rx) + r, py(bot)],
        radius=r, fill=stroke_color
    )

    # 3. Right stem above arch (stem_t → arch_t)
    draw.rounded_rectangle(
        [px(rx) - r, py(stem_t), px(rx) + r, py(arch_t)],
        radius=r, fill=stroke_color
    )

    # 4. Arch connecting left bar to right stem
    # We draw a filled arc (thick ellipse) using multiple overlapping ellipses
    arch_cx = (px(lx) + px(rx)) / 2
    arch_cy = py(arch_b)
    aw = (px(rx) - px(lx))      # horizontal radius * 2
    ah = py(arch_b) - py(arch_t) # vertical radius * 2

    # Draw arch as a thick crescent: outer ellipse minus inner
    # Outer
    outer_box = [arch_cx - aw / 2 - r, arch_cy - ah - r,
                 arch_cx + aw / 2 + r, arch_cy + r]
    # Inner (hollow)
    inner_box = [arch_cx - aw / 2 + r, arch_cy - ah + r,
                 arch_cx + aw / 2 - r, arch_cy - r]

    # We draw filled pieslice from 180° to 360° (top half of ellipse)
    # then mask with a slightly smaller inner ellipse of background color
    draw.pieslice(outer_box, start=180, end=360, fill=stroke_color)
    # Carve out centre of pie to leave arch ring
    draw.ellipse(inner_box, fill=BG_DARK if dot_color == GOLD else
                 (BG_LIGHT if stroke_color == MARK_DARK else TRANSPARENT))
    # Fill the flat bottom of the pie (chord) so it looks like open arch
    flat_y = arch_cy
    draw.rectangle(
        [arch_cx - aw / 2 - r, flat_y - r,
         arch_cx + aw / 2 + r, flat_y + r * 2],
        fill=BG_DARK if dot_color == GOLD else
             (BG_LIGHT if stroke_color == MARK_DARK else TRANSPARENT)
    )

    # 5. Accent dot at top of right stem
    dot_x = px(rx)
    dot_y = py(dot_cy)
    dr = int(size * dot_r)
    draw.ellipse(
        [dot_x - dr, dot_y - dr, dot_x + dr, dot_y + dr],
        fill=dot_color
    )


def draw_hunch_mark_transparent(size: int, stroke_color: tuple,
                                 dot_color: tuple) -> Image.Image:
    """Return a transparent canvas with the mark drawn on it."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    # For transparent, use transparent fill in arch carve-outs
    # Rewrite arch carve using TRANSPARENT fill
    _draw_hunch_transparent(draw, size / 2, size / 2, size, stroke_color, dot_color)
    return img


def _draw_hunch_transparent(draw, cx, cy, size, stroke_color, dot_color):
    sw = max(2, int(size * 0.088))
    r  = sw / 2

    def px(rel_x): return cx - size / 2 + rel_x * size
    def py(rel_y): return cy - size / 2 + rel_y * size

    lx, rx = 0.28, 0.58
    top_l  = 0.18
    bot    = 0.82
    arch_t = 0.395
    arch_b = 0.475
    stem_t = 0.145
    dot_cy = 0.085
    dot_r  = 0.052

    draw.rounded_rectangle(
        [px(lx) - r, py(top_l), px(lx) + r, py(bot)],
        radius=r, fill=stroke_color
    )
    draw.rounded_rectangle(
        [px(rx) - r, py(arch_b), px(rx) + r, py(bot)],
        radius=r, fill=stroke_color
    )
    draw.rounded_rectangle(
        [px(rx) - r, py(stem_t), px(rx) + r, py(arch_t)],
        radius=r, fill=stroke_color
    )

    arch_cx = (px(lx) + px(rx)) / 2
    arch_cy = py(arch_b)
    aw = (px(rx) - px(lx))
    ah = py(arch_b) - py(arch_t)

    outer_box = [arch_cx - aw / 2 - r, arch_cy - ah - r,
                 arch_cx + aw / 2 + r, arch_cy + r]
    inner_r = r * 0.5
    inner_box = [arch_cx - aw / 2 + inner_r, arch_cy - ah + inner_r,
                 arch_cx + aw / 2 - inner_r, arch_cy - inner_r]

    # For transparent: draw arch ring using two ellipse draws + erase centre
    draw.pieslice(outer_box, start=180, end=360, fill=stroke_color)
    # Only draw inner ellipse if it has valid non-zero area
    ix0, iy0, ix1, iy1 = inner_box
    if ix1 > ix0 + 1 and iy1 > iy0 + 1:
        draw.ellipse(inner_box, fill=TRANSPARENT)
    draw.rectangle(
        [arch_cx - aw / 2 - r, arch_cy - r,
         arch_cx + aw / 2 + r, arch_cy + r * 2],
        fill=TRANSPARENT
    )

    dot_x = px(rx)
    dot_y = py(dot_cy)
    dr = int(size * dot_r)
    draw.ellipse([dot_x - dr, dot_y - dr, dot_x + dr, dot_y + dr],
                 fill=dot_color)


# ── 1. App Icon – 1024×1024, dark bg ────────────────────────────────────────
def gen_app_icon():
    SIZE = 1024
    img = Image.new("RGBA", (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Rounded corners (like iOS)
    radius = int(SIZE * 0.2232)   # iOS icon corner radius ≈ 22.4%
    mask = Image.new("L", (SIZE, SIZE), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
    
    # Draw mark
    mark_size = int(SIZE * 0.60)
    mark_layer = draw_hunch_mark_transparent(mark_size, MARK_LIGHT, GOLD)
    offset = (SIZE - mark_size) // 2
    img.paste(mark_layer, (offset, offset), mark_layer)
    
    # Apply corner mask
    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    # For EAS/iOS we need solid bg (they add corners) — save as full square PNG
    final = Image.new("RGB", (SIZE, SIZE), (26, 26, 26))
    final.paste(result, mask=result.split()[3])
    final.save(path("icon.png"), "PNG", optimize=True)
    print(f"✓ icon.png ({SIZE}×{SIZE})")


# ── 2. Splash Icon – 2048×2048, transparent, mark centred ───────────────────
def gen_splash_icon():
    SIZE = 2048
    MARK = int(SIZE * 0.22)   # mark portion only (image will be centered small)
    img = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    
    # Draw dark mark centred
    mark_layer = draw_hunch_mark_transparent(MARK, MARK_DARK, (180, 160, 110, 255))
    offset = (SIZE - MARK) // 2
    img.paste(mark_layer, (offset, offset), mark_layer)
    
    img.save(path("splash-icon.png"), "PNG", optimize=True)
    print(f"✓ splash-icon.png ({SIZE}×{SIZE}, transparent)")


# ── 3. Android adaptive icon foreground – 1024×1024 transparent ─────────────
def gen_android_foreground():
    SIZE = 1024
    # Safe zone: mark should fit in inner 66% (adaptive icon clips to various shapes)
    MARK = int(SIZE * 0.50)
    img = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    mark_layer = draw_hunch_mark_transparent(MARK, MARK_DARK, (180, 160, 110, 255))
    offset = (SIZE - MARK) // 2
    img.paste(mark_layer, (offset, offset), mark_layer)
    img.save(path("android-icon-foreground.png"), "PNG", optimize=True)
    print(f"✓ android-icon-foreground.png ({SIZE}×{SIZE}, transparent)")


# ── 4. Android adaptive icon background – 1024×1024 solid ───────────────────
def gen_android_background():
    SIZE = 1024
    img = Image.new("RGB", (SIZE, SIZE), (250, 248, 245))
    img.save(path("android-icon-background.png"), "PNG", optimize=True)
    print(f"✓ android-icon-background.png ({SIZE}×{SIZE}, #FAF8F5 solid)")


# ── 5. Android adaptive icon monochrome – 1024×1024 white mark transparent ──
def gen_android_monochrome():
    SIZE = 1024
    MARK = int(SIZE * 0.50)
    img = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    mark_layer = draw_hunch_mark_transparent(MARK, WHITE, WHITE)
    offset = (SIZE - MARK) // 2
    img.paste(mark_layer, (offset, offset), mark_layer)
    img.save(path("android-icon-monochrome.png"), "PNG", optimize=True)
    print(f"✓ android-icon-monochrome.png ({SIZE}×{SIZE}, white on transparent)")


# ── 6. Favicon – 32×32 dark icon ────────────────────────────────────────────
def gen_favicon():
    SIZE = 32
    img = Image.new("RGB", (SIZE, SIZE), (26, 26, 26))
    draw = ImageDraw.Draw(img)
    mark_size = int(SIZE * 0.72)
    offset = (SIZE - mark_size) // 2
    # Draw tiny mark directly (transparent helper then paste)
    mark_layer = draw_hunch_mark_transparent(mark_size, (245, 240, 232, 255), (232, 213, 163, 255))
    img_rgba = img.convert("RGBA")
    img_rgba.paste(mark_layer, (offset, offset), mark_layer)
    img_rgba.convert("RGB").save(path("favicon.png"), "PNG", optimize=True)
    print(f"✓ favicon.png ({SIZE}×{SIZE})")


if __name__ == "__main__":
    gen_app_icon()
    gen_splash_icon()
    gen_android_foreground()
    gen_android_background()
    gen_android_monochrome()
    gen_favicon()
    print("\n✅ All Hunch brand assets generated successfully.")
