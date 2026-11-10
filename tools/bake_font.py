#!/usr/bin/env python3
"""
bake_font.py - the cluster's glyph atlases, made once from real font files and committed (shared/font_<family>.wad,
the distance field's bytes, and shared/font_baked.js, their metrics; .wad so the app build packages them), so the apps no longer enlarge the kit's small baked bitmaps (64 px at most, drawn at ~250 px: the
letters came out soft and odd).

Font: Barlow Semi Condensed (SIL Open Font License 1.1, shared/NOTICE), a DIN-like face of the kind
instrument clusters use, with upper and lower case. Families:
  bold   SemiBold (figures and text the layouts call bold)
  light  Regular
  wide   Michroma (SIL OFL 1.1, shared/NOTICE), thickened, for the figures, capitals and signs, and Barlow Semi
         Condensed Regular for the lower case and the degree and per cent signs (the units): the M and Sport layouts' face, after bimmer-lab's
         Cluster Themes. Its cells are wider (Michroma is a wide face); its capitals drawn the height of Barlow's.

Each cell: the glyph drawn at 4x, centred, its baseline at BASE of the cell's height (room below it for the
descenders of g j p q y, which 0.86 cut off), as a signed distance field
(0.5 at the outline, SPREAD atlas pixels each side), exactly as shared/font.js made it before. The advance of each
glyph is the font's own, in glyph heights (the cell's height).

    python3 tools/bake_font.py <folder with the .ttf files> [family ...]

With families named, only those are baked; the others' atlases and metrics stay as they are.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SHARED = os.path.join(HERE, '..', 'shared')
# the glyphs: what the layouts write, now with lower case
CHARS = ("0123456789-°PRNDSMOILCATEHKXFUGBVYWQJZ/ .:%+,'!|()"
         "abcdefghijklmnopqrstuvwxyz~<>=#&*?_")
CELL_W, CELL_H = 56, 64      # a cell (0.875 glyph heights wide: room for m and W)
UP = 4
COLS = 32
SPREAD = 8
SIZE = CELL_H * 0.92         # the font size a glyph is drawn at, in atlas pixels
BASE = 0.79                  # the baseline, of the cell's height
# signs a family with a second face for its lower case takes from it too (Michroma's degree sits on the line)
LOWER_SIGNS = '°%'
FAMILIES = {
    'bold': {'ttf': 'BarlowSemiCondensed-SemiBold.ttf'},
    'light': {'ttf': 'BarlowSemiCondensed-Regular.ttf'},
    # cells 72 x 48 and 16 to a row: the atlas 1152 x 288 (324 KB: within the 2048 px any GLES 2 GPU takes, and
    # a layout's start-up under 600 KB); scale: Michroma's capitals the height of Barlow's; grow: atlas px added round each glyph (thickened)
    'wide': {'ttf': 'Michroma-Regular.ttf', 'lower': 'BarlowSemiCondensed-Regular.ttf', 'cellW': 72, 'cellH': 48, 'cols': 16, 'scale': 0.93, 'grow': 1.65},
}


def cell(font, ch, cell_w=CELL_W, grow=0.0, cell_h=CELL_H):
    W, H = cell_w * UP, cell_h * UP
    im = Image.new('L', (W, H), 0)
    if ch != ' ':
        ImageDraw.Draw(im).text((W / 2, H * BASE), ch, font=font, fill=255, anchor='ms')
    ins = np.asarray(im) >= 128
    to_out = ndimage.distance_transform_edt(ins)        # inside: distance to the nearest outside pixel
    to_in = ndimage.distance_transform_edt(~ins)        # outside: distance to the nearest inside pixel
    sd = np.where(ins, to_out - 0.5, -(to_in - 0.5)) / UP
    sd = sd[UP // 2::UP, UP // 2::UP] + grow            # one sample a cell pixel, at its centre (grown: thicker)
    return np.clip(np.round((0.5 + sd / (2 * SPREAD)) * 255), 0, 255).astype(np.uint8)


def bake(src, fam, spec):
    ttf, cw, grow, cols, ch_ = spec['ttf'], spec.get('cellW', CELL_W), spec.get('grow', 0.0), spec.get('cols', COLS), spec.get('cellH', CELL_H)
    size = ch_ * 0.92
    font = ImageFont.truetype(os.path.join(src, ttf), int(round(size * UP * spec.get('scale', 1.0))))
    lower = ImageFont.truetype(os.path.join(src, spec['lower']), int(round(size * UP))) if spec.get('lower') else font
    rows = -(-len(CHARS) // cols)
    atlas = np.zeros((ch_ * rows, cw * cols), np.uint8)
    adv = []
    for k, ch in enumerate(CHARS):
        f, g = (lower, 0.0) if ch.islower() or ch in LOWER_SIGNS else (font, grow)
        oy, ox = (k // cols) * ch_, (k % cols) * cw
        atlas[oy:oy + ch_, ox:ox + cw] = cell(f, ch, cw, g, ch_)
        adv.append(round((f.getlength(ch) + 2 * g * UP) / (ch_ * UP), 4))
    with open(os.path.join(SHARED, 'font_' + fam + '.wad'), 'wb') as f:
        f.write(atlas.tobytes())
    print(fam, ttf, atlas.shape[1], 'x', atlas.shape[0], len(CHARS), 'glyphs')
    return {'font': ttf + (' + ' + spec['lower'] if spec.get('lower') else ''), 'chars': CHARS, 'cellW': cw, 'cellH': ch_, 'cols': cols, 'rows': rows, 'spread': SPREAD, 'adv': adv}


if __name__ == '__main__':
    src, only = sys.argv[1], sys.argv[2:]
    out = os.path.join(SHARED, 'font_baked.js')
    meta = {}
    if only and os.path.exists(out):
        with open(out) as f:
            body = f.read()
        meta = json.loads(body[body.index('=') + 1:].strip().rstrip(';'))
    for fam, spec in FAMILIES.items():
        if not only or fam in only:
            meta[fam] = bake(src, fam, spec)
    meta = {k: meta[k] for k in FAMILIES if k in meta}
    with open(out, 'w') as f:
        f.write("'use strict';\n/* The baked glyph atlases' metrics (tools/bake_font.py; Barlow Semi Condensed and Michroma, SIL OFL 1.1: NOTICE). */\n"
                'module.exports = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
    # (shared/NOTICE carries the fonts' copyright and the OFL: edited by hand, it has the layouts' notices too)
