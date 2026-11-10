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
 * The side gauges are the M8's (its coolant and boost bars, and the like in the setup's place): for a plug-in hybrid
 * the coolant and the battery's temperature on the left, the battery's power and the charge on the right; on a
 * petrol or diesel car (or with Show: Engine) the coolant and boost, the torque and the intake air.
 */
const C = require('./layout_common');
const B = require('./bimmer');

/* their theme (hud_themes.js mdash): one look */
const PAL = { bg: '#000000', text: '#eef1f6', fg: '#eef1f6', dim: '#848c98', faint: '#606876', red: '#e2242c', regen: '#3ddc84', glow: '#e2242c', track: '#5c6068', ev: '#4ab4ff' };
const pal = () => Object.assign({}, PAL);
const isNum = C.isNum;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const RPM_MAX = 8000;   // the M8's scale: 0-8

/* their map window ("hole" [705, 165, 510, 275], inset 6) */
const WINDOW = { x: 711, y: 171, w: 498, h: 263 };
/* their rev blades (tach_left / tach_right), each in a layer from just outside its outer edge (the right one clear of
 * the KOMBI's gear box, from x 1410) to the map window's edge */
const BLADE = { x0: 515, w: 196, y: 36, h: 558, y0: 566, y8: 66, ym: 303, xm: 528, kTop: 1.0684, kBot: 0.5434, round: 135, wBot: 52, wTop: 17, wBend: 44 };

/*
 * The side gauges, as the M8's coolant and boost bars: an icon over the left end, the unit over the right, the bar
 * (MBAR_FS: a thin track, a thicker fill, red zones, a red start tick), the scale's three labels under it. Each one
 * { icon, unit, labels: [[at 0..1, text] x3], value(d) 0..1, zero (where the fill starts), lo / hi (red to, from) }.
 */
function sideGauges(o, engine) {
    const isF = o.tempUnit !== 'c', us = o.speedUnit !== 'kmh';
    const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10), tu = '°' + (isF ? 'F' : 'C');
    const f01 = (v, a, b) => (isNum(v) ? Math.max(0, Math.min(1, (v - a) / (b - a))) : 0);
    const coolant = { icon: 'therm', unit: tu, labels: [[0, tl(70)], [0.5, tl(100)], [1, tl(130)]], value: (d) => f01(d.coolant, 70, 130), zero: 0, lo: -1, hi: 0.8 };
    if (engine) {
        const nm = C.torqueUnit(o) === 'kgm';
        return {
            left: [coolant,
                { icon: 'turbo', unit: us ? 'psi' : 'bar', labels: us ? [[0, '0'], [0.5, '20'], [1, '40']] : [[0, '0.0'], [0.5, '1.5'], [1, '3.0']],
                    value: (d) => (d.engineOn === false || !isNum(d.boostActual) ? 0 : us ? f01(d.boostActual * 14.5038, 0, 40) : f01(d.boostActual, 0, 3)), zero: 0, lo: -1, hi: 2 }],
            right: [
                { icon: 'torque', unit: nm ? 'kgm' : 'Nm', labels: nm ? [[0, '0'], [0.5, '25'], [1, '50']] : [[0, '0'], [0.5, '250'], [1, '500']], value: (d) => f01(d.torque, 0, 500), zero: 0, lo: -1, hi: 2 },
                { icon: 'therm', unit: tu, labels: [[0, tl(0)], [0.5, tl(40)], [1, tl(80)]], value: (d) => f01(d.iat, 0, 80), zero: 0, lo: -1, hi: 0.75 }],
        };
    }
    return {
        // engine: the coolant and the battery's temperature (0-50 C, hot from 45)
        left: [coolant, { icon: 'batteryTemp', unit: tu, labels: [[0, tl(0)], [0.5, tl(25)], [1, tl(50)]], value: (d) => f01(d.battTemp, 0, 50), zero: 0, lo: -1, hi: 0.9 }],
        // eDrive: the battery's power (-50 kW charging, blue, to 100 kW drawn) and the charge (red under 10%)
        right: [{ icon: 'bolt', unit: 'kW', labels: [[0, '-50'], [1 / 3, '0'], [1, '100']], value: (d) => f01(d.kw, -50, 100), zero: 1 / 3, lo: -1, hi: 2, neg: true },
            { icon: 'battery', unit: '%', labels: [[0, '0'], [0.5, '50'], [1, '100']], value: (d) => f01(d.soc, 0, 100), zero: 0, lo: 0.1, hi: 2 }],
    };
}
/** One side gauge at (x, y), w wide: its icon, its unit and its bar (MBAR_FS, which draws the scale's numbers too:
 * one layer, not three text pieces). */
function gauge(T, key, x, y, w, g) {
    const fg = B.role('fg'), sg = B.smallGlyphs('orb', 'm_scale');
    const nums = g.labels.map((l) => Number(l[1])), dec = g.labels.some((l) => /\./.test(l[1])) ? 1 : 0;
    return [
        B.icon(key + 'Icon', x - 4, y - 6, 38, 36, g.icon, 'fg'),
        T(key + 'Unit', [x + w - 90, y - 4, 90, 32], 'm_unit', g.unit, fg, 'right'),
        { key, kind: 'mbar', x: x - 6, y: y + 30, w: w + 10, h: 34 + sg.h + 2,
            params: { u_zero: [g.zero], u_zones: [g.lo, g.hi, 0, 0], u_marks: g.labels.map((l) => l[0]).concat([-1]).slice(0, 4),
                u_lab: nums.concat([dec]), u_glyph: sg.glyph, u_glyph2: sg.glyph2, u_labH: [sg.h] },
            colors: (t) => ({ fill: t.fg, neg: t.ev, track: t.track, redc: t.red }),
            value: g.value, max: 1, sweep: true },
    ];
}

module.exports = {
    id: 'm',
    title: 'M',
    font: 'orb',
    stripGear: true,    // (the gear is its centre: kept over the car's own strip)
    stripFuel: false,   // (its own fuel dial)
    mapWindow: WINDOW,
    speedGauge: false,  // (the speed in figures only, as theirs)
    gearNumber: true,   // (the gear's number, as the M8's)
    ownStripGauges: true,   // (the charge is its own right-hand gauge, the fuel its dial: none of the strip's bars)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const strip = C.strip(o), map = o.centre === 'map', stock = o.centre === 'stock' && !strip, mcar = C.mCar(o);
        const engine = C.engineFocus(o) || o.vehicle === 'ice', us = o.speedUnit !== 'kmh';
        const [redFrom, orange] = B.redMarks(o, RPM_MAX);
        const T = (key, box, font, txt, colors, align) => B.text('orb', key, box, font, txt, colors, align);
        const fg = B.role('fg'), dim = B.role('dim'), faint = B.role('faint');
        // the side gauges, as the M8's (its coolant and boost bars, left): engine left, eDrive right
        const G = sideGauges(o, engine);
        const rows = strip ? [222, 324] : [104, 462];   // (the right ones; full screen above and below the KOMBI's gear box, y 262-454)
        // the background: black (with the map, round its window; the stock centre, round its area)
        const W2 = WINDOW, around = [{ x: 0, y: 0, w: 1920, h: W2.y }, { x: 0, y: W2.y + W2.h, w: 1920, h: 720 - W2.y - W2.h },
            { x: 0, y: W2.y, w: W2.x, h: W2.h }, { x: W2.x + W2.w, y: W2.y, w: 1920 - W2.x - W2.w, h: W2.h }];
        const list = map ? around.map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg'))
            : stock ? [C.flat('bgL', 0, 0, 566, 720, 'bg'), C.flat('bgR', 1104, 0, 816, 720, 'bg')] : [C.flat('bg', 0, 0, 1920, 720, 'bg')];
        /*
         * The backdrop's parts (MDASH_FS), each in its own small layer, never one over the whole panel: theirs in one
         * full-screen layer restarted the cluster on the car (twice). The cards, the centre line, the side dials and
         * the stripes; over the background (a flat, z -100), the dials over the cards.
         */
        const md = { u_card: [170, 536, 186, 48], u_cardTop: [0.00130995, -1.417868, 468.53], u_cardCutR: [700, 106.2, 565.9], u_cardFill: [0.055],
            u_blade: [528, 303, 1.0684, 0.5434], u_bladeB: [135, 15], u_line: [742, 376, 1181, 55], u_mark: [926, 150, 1.2],
            u_gaugeL: [244, 430, 144, 0], u_gaugeR: [1654, 430, 144, 0] };
        const part = (key, n, x, y, w, h, extra) => Object.assign({ key, kind: 'mdash', x, y, w, h, z: -90, params: Object.assign({ u_part: [n], u_off: [x, y] }, md),
            colors: (t) => ({ red: t.red }) }, extra || {});
        const dials = (d) => ({
            u_gaugeL: [244, 430, 144, isNum(d.fuelPct) ? Math.round(clamp01(d.fuelPct / 100) * 200) / 200 : 0],
            u_gaugeR: [1654, 430, 144, isNum(d.oil) ? Math.round(clamp01((d.oil - 50) / 100) * 200) / 200 : 0],
        });
        list.push(part('cardL', 1, 160, 78, 492, 466), part('cardR', 1, 1268, 78, 492, 466),
            part('fuelDial', 3, 58, 390, 284, 214, { z: -80, dyn: dials }), part('oilDial', 3, 1578, 390, 284, 214, { z: -80, dyn: dials }));
        // (with the map the centre line and the stripes would be under its window: left out)
        if (!map) list.push(part('centreLine', 2, 734, 366, 456, 22), part('mStripes', 4, 918, 144, 84, 36));
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
        // the blades' numerals, every 2000 as the M8's, on the blades' inner side (their places' curve; the top one
        // kept clear of the camera's cowl, x 730-1190 above y 128)
        [[0, 693, 547], [2, 659, 422], [4, 653, 297], [6, 675, 172], [8, 712, 47]].forEach(([n, cx, y]) => {
            const w = n === 8 ? 30 : 60;
            list.push(T('nl' + n, [cx - w / 2, y, w, 38], 'm_num', String(n), fg, 'center'), T('nr' + n, [1920 - cx - w / 2, y, w, 38], 'm_num', String(n), fg, 'center'));
        });
        list.push(T('rpmUnit', [1342, strip ? 546 : 590, 228, 29], 'm_tiny', '1/min x1000', faint, 'left'));   // (full screen under the lower right gauge)
        // the gear and the speed: in the middle, or (the map, an M car's boxes) their map-up places
        // the gear: its number (P, R, N as letters), the shift programme's stack beside it, as the M8's
        const gearNum = (d) => { const g = C.gearText(d); return /^[DSM]\d+$/.test(g) ? g.slice(1) : g; };
        const gearC = (t, d) => ({ color: [B.shiftNow(o, d) ? t.red : t.fg, 1], glow: [t.fg, 0] });
        const stack = (x, y, z) => Object.assign(B.icon('gearStack', x, y, z, z, 'stack', 'fg'), { visible: (d) => /^[DSM]\d*$/.test(C.gearText(d)) });
        if (!stock) {
            if (map || mcar) {
                list.push(T('gear', [710, 450, 230, 117], 'm_gear', gearNum, gearC, 'right'), stack(944, 512, 54),
                    T('speedDigits', [990, 467, 216, 82], 'm_speed', (d) => C.speedText(o, d), fg, 'left'),
                    T('speedUnit', [990, 549, 108, 29], 'm_tiny', C.speedUnit(o), dim, 'left'));
            } else {
                list.push(T('gear', [700, 246, 520, 117], 'm_gear', gearNum, gearC, 'center'), stack(1014, 290, 54),
                    T('speedDigits', [700, 400, 520, 82], 'm_speed', (d) => C.speedText(o, d), fg, 'center'),
                    T('speedUnit', [1111, 409, 97, 29], 'm_tiny', C.speedUnit(o), dim, 'left'));
            }
        }
        // the side gauges: engine left (x 300), eDrive right (x 1420)
        G.left.forEach((g, i) => list.push(...gauge(T, 'gl' + i, 300, [222, 324][i], 200, g)));
        G.right.forEach((g, i) => list.push(...gauge(T, 'gr' + i, 1420, rows[i], 200, g)));
        // the fuel dial's labels and the oil dial's (the dials are the backdrop's)
        const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
        list.push(T('fuelHi', [131, 419, 36, 28], 'm_gl', '1', fg, 'center'), T('fuelMid', [170, 484, 74, 28], 'm_gl', '1/2', fg, 'left'),
            T('fuelLo', [237, 533, 36, 28], 'm_gl', '0', fg, 'left'), B.icon('fuelIcon', 72, 536, 26, 29, 'fuel', 'dim'),
            T('oilHi', [1670, 425, 103, 28], 'm_gl', tl(150), fg, 'right'), T('oilMid', [1630, 483, 103, 28], 'm_gl', tl(100), fg, 'right'),
            T('oilLo', [1558, 532, 103, 28], 'm_gl', tl(50), fg, 'right'), T('oilUnit', [1798, 514, 48, 29], 'm_tiny', '°' + (o.tempUnit === 'c' ? 'C' : 'F'), dim, 'left'),
            B.icon('oilIcon', 1784, 544, 38, 22, 'oilcan', 'dim'));
        if (stock) return list.filter((p) => p.kind === 'mtach' || /^card/.test(p.key) || p.x + p.w <= 566 || p.x >= 1104);
        return list;
    },
};
