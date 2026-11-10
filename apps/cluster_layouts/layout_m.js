'use strict';
/**
 * layout_m.js - "M": bimmer-lab's M theme for Cluster Themes (MIT, Copyright (c) 2026 bimmer-lab,
 * github.com/bimmer-lab/apps; traced off a photo of an M8's cluster), as theirs: their shaders (MDASH_FS: the
 * backdrop with its cards, centre line, tyre block, side dials, M stripes and setup bars; MTACH_FS: the two bowed glass
 * rev blades) with their layout's numbers, and every text where their layout puts it, in their faces (Orbitron
 * Black, Barlow Medium; font.js 'orb'), the size and on the line theirs are (bimmer.js).
 *
 * Fitted to the G05: their time, fuel range, outside temperature and badge along the bottom left out (the car's own
 * strip shows them); the M stripes, the top numerals moved clear of the camera's cowl. With the Waze map their
 * window between the blades (the map drawn there, map_window.js) and their map-up places for the gear and speed; on
 * an M car (its KOMBI's two boxes in the middle) the gear and speed in those places too. Full screen without the
 * car's strip the right-hand setup rows stand clear of the KOMBI's own gear box (above and below it).
 *
 * The four setup rows (theirs: the M setup's engine, chassis, steering and gearbox, each with its level bar), for a
 * plug-in hybrid: the drive mode, the battery's power, the charge and the gearbox's programme (on a petrol or diesel
 * car, or with Show: Engine, boost and the coolant for the power and the charge).
 */
const C = require('./layout_common');
const B = require('./bimmer');

/* their theme (hud_themes.js mdash): one look */
const PAL = { bg: '#000000', text: '#eef1f6', fg: '#eef1f6', dim: '#848c98', faint: '#606876', red: '#e2242c', regen: '#3ddc84', glow: '#e2242c' };
const pal = () => Object.assign({}, PAL);
const isNum = C.isNum;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const RPM_MAX = 7000;   // their scale: 0-7

/* their map window ("hole" [705, 165, 510, 275], inset 6) */
const WINDOW = { x: 711, y: 171, w: 498, h: 263 };
/* their rev blades (tach_left / tach_right), each in a layer from just outside its outer edge (the right one clear of
 * the KOMBI's gear box, from x 1410) to the map window's edge */
const BLADE = { x0: 515, w: 196, y: 36, h: 558, y0: 566, y8: 66, ym: 303, xm: 528, kTop: 1.0684, kBot: 0.5434, round: 135, wBot: 52, wTop: 17, wBend: 44 };

module.exports = {
    id: 'm',
    title: 'M',
    font: 'orb',
    stripGear: true,    // (the gear is its centre: kept over the car's own strip)
    stripFuel: false,   // (its own fuel dial)
    mapWindow: WINDOW,
    speedGauge: false,  // (the speed in figures only, as theirs)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const strip = C.strip(o), map = o.centre === 'map', stock = o.centre === 'stock' && !strip, mcar = C.mCar(o);
        const engine = C.engineFocus(o) || o.vehicle === 'ice', us = o.speedUnit !== 'kmh';
        const [redFrom, orange] = B.redMarks(o, RPM_MAX);
        const T = (key, box, font, txt, colors, align) => B.text('orb', key, box, font, txt, colors, align);
        const fg = B.role('fg'), dim = B.role('dim'), faint = B.role('faint');
        // the setup rows: their places, or full screen (the KOMBI's gear box at x 1410-1662, y 262-454) clear of it
        const ROWS = strip ? [214, 269, 426, 481] : [150, 205, 458, 500];
        const modeOf = (d) => String(d.driveMode || C.modeText(d, { mode: 'COMFORT' })).toUpperCase();
        const rows = [
            { icon: 'gauge', txt: modeOf, max: 3, lit: (d) => { const m = modeOf(d); return /SPORT/.test(m) ? 3 : /ECO|ELECTRIC/.test(m) ? 1 : 2; } },
            engine
                ? { icon: 'shock', txt: (d) => C.boostText(o, d).toUpperCase(), max: 3, lit: (d) => Math.max(1, Math.ceil(C.boostFrac(d) * 3)) }
                : { icon: 'shock', txt: (d) => (isNum(d.kw) ? (Math.abs(d.kw) < 10 ? d.kw.toFixed(1) : Math.round(d.kw)) + ' KW' : '-- KW'), max: 3, lit: (d) => (isNum(d.kw) ? Math.max(1, Math.min(3, Math.ceil(Math.abs(d.kw) / 33))) : 0) },
            engine
                ? { icon: 'wheel', txt: (d) => C.tempText(o, d.coolant), max: 2, lit: (d) => (isNum(d.coolant) && d.coolant >= 70 ? 2 : 1) }
                : { icon: 'wheel', txt: (d) => (isNum(d.soc) ? Math.round(d.soc) + '%' : '--'), max: 2, lit: (d) => (isNum(d.soc) ? (d.soc >= 50 ? 2 : 1) : 0) },
            { icon: 'cog', txt: (d) => (d.mode === 'S' ? 'SPORT' : d.mode === 'M' ? 'MANUAL' : 'DRIVE'), max: 2, lit: (d) => (d.mode === 'S' || d.mode === 'M' ? 2 : 1) },
        ];
        const W = [280, 280, 182, 182];
        const list = [{
            key: 'backdrop', kind: 'mdash', x: 0, y: 0, w: 1920, h: strip ? C.STRIP_Y : 720,
            params: {
                u_card: [170, 536, 186, 48], u_cardTop: [0.00130995, -1.417868, 468.53], u_cardCutR: [700, 106.2, 565.9], u_cardFill: [0],
                u_blade: [528, 303, 1.0684, 0.5434], u_bladeB: [135, 15], u_line: [742, 376, 1181, 55], u_tyre: [369, 328, 1.2],
                // (the M stripes below the camera's cowl: theirs at y 66)
                u_mark: [926, 138, 1.2],
                u_seg0: [1454, ROWS[0] + 33, W[0], 6], u_seg1: [1454, ROWS[1] + 33, W[1], 6], u_seg2: [1454, ROWS[2] + 33, W[2], 6], u_seg3: [1454, ROWS[3] + 33, W[3], 6],
                u_segMax: rows.map((r) => r.max), u_segSlant: [6],
                u_hole: map ? [WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h] : stock ? [566, 0, 538, 720] : [0, 0, 0, 0], u_holeR: [map ? 24 : 0],
            },
            colors: (t) => ({ red: t.red }),
            dyn: (d) => ({
                u_gaugeL: [244, 430, 144, isNum(d.fuelPct) ? Math.round(clamp01(d.fuelPct / 100) * 200) / 200 : 0],
                u_gaugeR: [1654, 430, 144, isNum(d.oil) ? Math.round(clamp01((d.oil - 50) / 100) * 200) / 200 : 0],
                u_segLit: rows.map((r) => r.lit(d)),
            }),
        }];
        // the rev blades: the engine speed, eased by the engine
        const blade = (key, right) => ({
            key, kind: 'mtach', x: right ? 1920 - BLADE.x0 - BLADE.w : BLADE.x0, y: BLADE.y, w: BLADE.w, h: BLADE.h,
            params: { u_side: [right ? 1 : -1], u_geoA: [BLADE.y0 - BLADE.y, BLADE.y8 - BLADE.y, BLADE.ym - BLADE.y, BLADE.xm - BLADE.x0],
                u_geoB: [BLADE.kTop, BLADE.kBot, BLADE.round], u_wid: [BLADE.wBot, BLADE.wTop, BLADE.wBend], u_ticks: [RPM_MAX / 1000],
                u_orange: [orange], u_redFrom: [redFrom] },
            colors: (t) => ({ red: t.red }),
            dyn: (d) => ({ u_shiftNow: [B.shiftNow(o, d) ? 1 : 0] }),
            value: (d) => (isNum(d.rpm) ? clamp01(d.rpm / RPM_MAX) : 0), max: 1, sweep: true,
        });
        list.push(blade('tachL', false), blade('tachR', true));
        // the blades' numerals (the top ones kept clear of the camera's cowl, x 730-1190 above y 128)
        [[0, 645, 547, 96], [2, 606, 404, 96], [4, 605, 261, 96], [6, 668, 118, 40], [7, 695, 47, 34]].forEach(([n, x, y, w]) => list.push(T('nl' + n, [x, y, w, 38], 'm_num', String(n), fg, 'center')));
        [[0, 1179, 547, 96], [2, 1218, 404, 96], [4, 1219, 261, 96], [6, 1212, 118, 40], [7, 1191, 47, 34]].forEach(([n, x, y, w]) => list.push(T('nr' + n, [x, y, w, 38], 'm_num', String(n), fg, 'center')));
        list.push(T('rpmUnit', [1342, 546, 228, 29], 'm_tiny', '1/min x1000', faint, 'left'));
        // the gear and the speed: in the middle, or (the map, an M car's boxes) their map-up places
        const gearC = (t, d) => ({ color: [B.shiftNow(o, d) ? t.red : t.fg, 1], glow: [t.fg, 0] });
        if (!stock) {
            if (map || mcar) {
                list.push(T('gear', [710, 450, 230, 117], 'm_gear', C.gearText, gearC, 'right'),
                    T('speedDigits', [990, 467, 216, 82], 'm_speed', (d) => C.speedText(o, d), fg, 'left'),
                    T('speedUnit', [990, 549, 108, 29], 'm_tiny', C.speedUnit(o), dim, 'left'));
            } else {
                list.push(T('gear', [700, 246, 520, 117], 'm_gear', C.gearText, gearC, 'center'),
                    T('speedDigits', [700, 400, 520, 82], 'm_speed', (d) => C.speedText(o, d), fg, 'center'),
                    T('speedUnit', [1111, 409, 97, 29], 'm_tiny', C.speedUnit(o), dim, 'left'));
            }
        }
        // the tyres (the car glyph and dividers are the backdrop's)
        const pr = (v) => (us ? String(Math.round(v * 14.5038)) : v.toFixed(1));
        list.push(T('tyreUnitP', [321, 201, 96, 29], 'm_tiny', us ? 'psi' : 'bar', dim, 'center'),
            B.icon('tyreIcon', 301, 230, 29, 29, 'tyre', 'dim'),
            T('tyreUnitT', [345, 231, 53, 29], 'm_tiny', '°' + (o.tempUnit === 'c' ? 'C' : 'F'), dim, 'left'));
        [['FL', 267, 263, 297], ['FR', 393, 263, 297], ['RL', 267, 347, 375], ['RR', 393, 347, 375]].forEach(([k, x, yp, yt]) => list.push(
            T('tp' + k, [x, yp, 72, 26], 'm_tyre', (d) => (d.tyres && isNum(d.tyres.p[k]) ? pr(d.tyres.p[k]) : '--'), fg, 'center'),
            T('tt' + k, [x, yt, 72, 26], 'm_tyre', (d) => (d.tyres && isNum(d.tyres.t[k]) ? String(Math.round(C.tempIn(o, d.tyres.t[k]))) : '--'), fg, 'center')));
        // the fuel dial's labels and the oil dial's (the dials are the backdrop's)
        const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
        list.push(T('fuelHi', [131, 419, 36, 28], 'm_gl', '1', fg, 'center'), T('fuelMid', [170, 484, 74, 28], 'm_gl', '1/2', fg, 'left'),
            T('fuelLo', [237, 533, 36, 28], 'm_gl', '0', fg, 'left'), B.icon('fuelIcon', 72, 536, 26, 29, 'fuel', 'dim'),
            T('oilHi', [1670, 425, 103, 28], 'm_gl', tl(150), fg, 'right'), T('oilMid', [1630, 483, 103, 28], 'm_gl', tl(100), fg, 'right'),
            T('oilLo', [1558, 532, 103, 28], 'm_gl', tl(50), fg, 'right'), T('oilUnit', [1798, 514, 48, 29], 'm_tiny', '°' + (o.tempUnit === 'c' ? 'C' : 'F'), dim, 'left'),
            B.icon('oilIcon', 1784, 544, 38, 22, 'oilcan', 'dim'));
        // the setup rows: an icon and its text (the level bars are the backdrop's)
        rows.forEach((r, i) => list.push(B.icon('setupIcon' + i, 1396, ROWS[i], 31, 29, r.icon, 'fg'),
            T('setup' + i, [1457, ROWS[i], 132 + (i < 2 ? 140 : 40), 29], 'm_label', r.txt, fg, 'left')));
        if (stock) return list.filter((p) => /^(mdash|mtach)$/.test(p.kind) || p.x + p.w <= 566 || p.x >= 1104);
        return list;
    },
};
