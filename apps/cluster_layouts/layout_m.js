'use strict';
/**
 * layout_m.js - "M": the M display. After bimmer-lab's M theme for Cluster Themes (MIT, Copyright (c) 2026
 * bimmer-lab, github.com/bimmer-lab/apps): its arrangement and its look, redrawn with this app's engine (every piece a
 * shader on the cluster's own GPU, the readings sent as numbers), in its wide face (Michroma, thickened; font.js
 * 'wide'), fitted to the G05's glass, the KOMBI's boxes and the car's own bottom strip, and made for a plug-in hybrid.
 *
 * Two bowed glass rev blades either side of the centre, filling with the engine speed under a red marker; in an
 * electric drive (eDrive ELECTRIC, or the engine off) they read the battery's power, 0-100 kW. Between them the
 * gear, large, a rule and the speed. Left: the tyres (pressure and temperature at each corner) and the fuel in the
 * corner; right: the drive mode, the battery's power (boost on a petrol or diesel car, or with Show: Engine) and
 * the charge (the coolant on a petrol or diesel car), each with its bar, and the oil temperature in the corner.
 * The M stripes over the gear. Nothing along the bottom: the car's own strip shows the time, the outside temperature
 * and the ranges (with it, the drive mode too, so the mode's row is left out and the charge's row reads the
 * battery's temperature: the strip's charge gauge is under it).
 */
const C = require('./layout_common');

const PALETTES = {
    comfort: { accent: '#ff2a1f', glow: '#ff2a1f', mode: 'COMFORT' },
    sport: { accent: '#ff3b1f', glow: '#ff5a1f', mode: 'SPORT' },
    efficient: { accent: '#3a8cff', glow: '#3a8cff', mode: 'EFFICIENT' },
};
const BASE = {
    bg: '#000000', text: '#ffffff', dim: '#8c949e', track: '#1d2025', red: '#ff2a1f', ev: '#4ab4ff', regen: '#3ddc84',
    glass0: '#262a30', glass1: '#b4bbc3', edge: '#d9dde2', tick: '#c9ced4', rule: '#5c636c', num: '#ffffff', tip: '#ffffff',
    green: '#3ddc84', mBlue: '#5ab4ff', mNavy: '#2b3fd0', oilCold: '#3a6cff',
};
const pal = (lookId) => Object.assign({}, BASE, PALETTES[lookId] || PALETTES.comfort);

const white = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.08] });
const lbl = (t) => ({ color: [t.dim, 1], glow: [t.glow, 0] });
const isNum = C.isNum;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ---------- geometry ---------- */
/** The circle through three points: { x, y, r }. */
function circle3(a, b, c) {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const s = (p) => p[0] * p[0] + p[1] * p[1];
    const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
    const y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
    return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
}
/** A point's angle round a centre: degrees clockwise from 12 o'clock, 0..360. */
const angleOf = (c, p) => ((Math.atan2(p[0] - c.x, -(p[1] - c.y)) * 180 / Math.PI) + 360) % 360;

/* the left blade's centre line (bimmer-lab's blade: bottom, bulge, top), the right one mirrored */
const BLADE = [[640, 556], [568, 300], [694, 74]], BLADE_T = 56;
const bladeNum = 38;           // numeral height
/*
 * A rev blade: the glass edge (a band a little thicker, light) and the blade over it (a band filling from the
 * bottom with the engine speed, light towards its end, the red marker riding it; ticks and numerals on its inner
 * side). side: -1 left, 1 right. In an electric drive the scale is the battery's power, 0-100 kW.
 */
function blade(o, side, key) {
    const pts = BLADE.map(([x, y]) => [side < 0 ? x : 1920 - x, y]);
    const c = circle3(pts[0], pts[1], pts[2]);
    const a0 = angleOf(c, pts[0]), a1 = angleOf(c, pts[2]);
    const xs = pts.map((p) => p[0]), inner = BLADE_T / 2 + 96, outer = BLADE_T / 2 + 10;
    const x0 = Math.round(side < 0 ? Math.min(...xs) - outer : Math.min(...xs) - inner);
    const x1 = Math.round(side < 0 ? Math.max(...xs) + inner : Math.max(...xs) + outer);
    const y0 = 30, y1 = 600;
    const s = C.rpmScale(o), num = -(BLADE_T / 2 + 40);
    const geo = (T) => [c.x - x0, c.y - y0, c.r, T];
    const marks = (d) => (C.electric(o, d) ? [4, 25, bladeNum * 0.8, num] : [s.max, 1, bladeNum, num]);
    return [
        { key: key + 'Edge', kind: 'band', x: x0, y: y0, w: x1 - x0, h: y1 - y0,
            params: { u_geo: geo(BLADE_T + 5), u_span: [a0, a1, 0, 0], u_marks: [0, 0, 0, 0], u_red: [2], u_soft: [1] },
            colors: (t) => ({ track: t.edge, fill0: t.edge, fill1: t.edge, redc: t.edge, tip: t.edge, tick: t.edge, num: t.num }),
            value: () => 0, max: 1 },
        { key, kind: 'band', x: x0, y: y0, w: x1 - x0, h: y1 - y0,
            params: { u_geo: geo(BLADE_T), u_span: [a0, a1, 0, 0], u_marks: [s.max, 1, bladeNum, num], u_red: [s.red / s.max], u_soft: [0.5] },
            dyn: (d) => ({ u_marks: marks(d), u_red: [C.electric(o, d) ? 2 : s.red / s.max] }),
            colors: (t, d) => (C.electric(o, d)
                ? { track: t.track, fill0: t.glass0, fill1: t.ev, redc: t.red, tip: t.ev, tick: t.tick, num: t.num }
                : { track: t.track, fill0: t.glass0, fill1: t.glass1, redc: t.red, tip: t.accent, tick: t.tick, num: t.num }),
            value: revValue(o), max: 1, sweep: true },
    ];
}
/** The blades' (and the bar's) reading, 0..1: the engine speed, or the battery's power in an electric drive. */
const revValue = (o) => (d) => (C.electric(o, d) ? (isNum(d.kw) ? clamp01(d.kw / 100) : 0)
    : isNum(d.rpm) ? clamp01(d.rpm / 1000 / C.rpmScale(o).max) : 0);

/** The rev bar under the map: the blades' reading on a straight segmented bar. */
function revBar(o, x, y, w, h) {
    const s = C.rpmScale(o);
    return { key: 'revs', kind: 'band', x, y, w, h,
        params: { u_geo: [4, h / 2, 0, Math.max(4, h - 8)], u_span: [0, 0, 56, 0.3], u_marks: [0, 0, 0, 0], u_red: [s.red / s.max], u_soft: [1] },
        dyn: (d) => ({ u_red: [C.electric(o, d) ? 2 : s.red / s.max] }),
        colors: (t, d) => ({ track: t.track, fill0: t.glass0, fill1: C.electric(o, d) ? t.ev : t.glass1, redc: t.red, tip: t.accent, tick: t.dim, num: t.num }),
        value: revValue(o), max: 1, sweep: true };
}

/** The M stripes: three segments of a bar, light blue, dark blue, red. */
const stripes = (x, y) => ({ key: 'mStripes', kind: 'band', x, y, w: 104, h: 26,
    params: { u_geo: [4, 13, 0, 18], u_span: [0, 0, 3, 0.18], u_marks: [0, 0, 0, 0], u_red: [0.667], u_soft: [1] },
    colors: (t) => ({ track: t.bg, fill0: t.mBlue, fill1: t.mNavy, redc: t.red, tip: t.red, tick: t.bg, num: t.bg }),
    value: () => 1, max: 1 });

const icon = (key, x, y, size, id, colour) => ({ key, kind: 'icon', x, y, w: size, h: size, params: { u_icon: [id], u_line: [0] },
    colors: (t, d) => ({ color: [typeof colour === 'function' ? colour(t, d) : t[colour], 1] }) });

const pressIn = (o, bar) => (o.speedUnit === 'kmh' ? bar.toFixed(1) : String(Math.round(bar * 14.5038)));
/** The tyres: pressure over temperature at each corner, the car between them. */
function tyres(o, x, y) {
    const out = [
        C.text('tyreUnit', x + 70, y, 120, 22, (o.speedUnit === 'kmh' ? 'bar' : 'psi') + '  °' + (o.tempUnit === 'c' ? 'C' : 'F'), lbl, { align: 0.5 }),
        icon('tyreCar', x + 76, y + 70, 54, 10, 'dim'),
        C.flat('tyreRuleL', x, y + 124, 62, 2, 'rule'), C.flat('tyreRuleR', x + 144, y + 124, 62, 2, 'rule'),
    ];
    ['FL', 'FR', 'RL', 'RR'].forEach((k, i) => {
        const cx = i % 2 ? x + 140 : x, cy = y + (i < 2 ? 42 : 138);
        out.push(C.text('tyre' + k, cx, cy, 66, 30, (d) => (d.tyres && isNum(d.tyres.p[k]) ? pressIn(o, d.tyres.p[k]) : '--'), white, { align: i % 2 ? 1 : 0 }),
            C.text('tyreT' + k, cx, cy + 36, 66, 26, (d) => (d.tyres && isNum(d.tyres.t[k]) ? String(Math.round(C.tempIn(o, d.tyres.t[k]))) : ''), white, { align: i % 2 ? 1 : 0 }));
    });
    return out;
}

/*
 * A corner gauge (the fuel bottom left, the oil temperature bottom right): a quarter arc round (cx, cy), radius
 * 160, from the bottom up to the side, with its three labels inside it. side -1 left, 1 right.
 */
function corner(key, side, value, labels, colors) {
    const cx = side < 0 ? 250 : 1670, cy = 412, R = 160, T = 20;
    const x = side < 0 ? 64 : 1650, y = 236, w = 206, h = 370;
    const out = [{ key, kind: 'band', x, y, w, h,
        params: { u_geo: [cx - x, cy - y, R, T], u_span: [180, side < 0 ? 270 : 90, 0, 0], u_marks: [4, 0, 0, 0], u_red: [2], u_soft: [0] },
        colors, value, max: 1, sweep: true }];
    // the labels at 0, a half and the end, inside the arc
    labels.forEach((l, i) => {
        const a = (180 + (side < 0 ? 1 : -1) * 45 * i) * Math.PI / 180, r = R - 50;
        const px = cx + r * Math.sin(a), py = cy - r * Math.cos(a), lw = 76;
        out.push(C.text(key + 'L' + i, Math.round(px - lw / 2), Math.round(py - 14), lw, 28, l, white, { align: 0.5 }));
    });
    return out;
}

/** The drive mode's place on a bar of three: eco 1, comfort or hybrid 2, sport 3. */
const modeLevel = (d) => { const m = String(d.driveMode || (d.mode === 'S' || d.mode === 'M' ? 'SPORT' : 'COMFORT')); return /SPORT|M\d/.test(m) ? 1 : /ECO|ELECTRIC/.test(m) ? 1 / 3 : 2 / 3; };
/** A row: an icon, its reading and a bar under it. */
function row(key, x, y, w, iconId, txt, value, fill) {
    return [
        icon(key + 'Icon', x, y + 2, 30, iconId, 'dim'),
        C.text(key, x + 44, y, w - 44, 28, txt, white, { align: 0, tracking: 0.04 }),
        { key: key + 'Bar', kind: 'band', x: x + 40, y: y + 34, w: w - 40, h: 12,
            params: { u_geo: [4, 6, 0, 6], u_span: [0, 0, 3, 0.06], u_marks: [0, 0, 0, 0], u_red: [2], u_soft: [1] },
            colors: (t, d) => { const f = fill(t, d); return { track: t.rule, fill0: f, fill1: f, redc: t.red, tip: f, tick: t.dim, num: t.num }; },
            value, max: 1, sweep: true },
    ];
}

module.exports = {
    id: 'm',
    title: 'M',
    font: 'wide',
    stripGear: true,   // (the gear is the layout's centre: kept over the car's own strip too)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const engine = C.engineFocus(o), ice = o.vehicle === 'ice', strip = C.strip(o), map = o.centre === 'map' || o.centre === 'stock';
        const mcar = C.mCar(o);
        const list = [C.flat('bg', 0, 0, 1920, 720, 'bg')];
        const tempLbl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
        const kwC = (t, d) => (isNum(d.kw) && d.kw < -0.3 ? t.regen : t.ev);
        // the battery's power (boost), the charge (coolant)
        const power = engine || ice
            ? { icon: 5, txt: (d) => C.boostText(o, d), value: C.boostFrac, fill: (t) => t.accent }
            : { icon: 7, txt: C.kwText, value: (d) => (isNum(d.kw) ? clamp01(Math.abs(d.kw) / 100) : 0), fill: kwC };
        const third = strip && !(engine || ice)
            ? { icon: 0, txt: (d) => 'BATT ' + C.tempText(o, d.battTemp), value: (d) => (isNum(d.battTemp) ? clamp01(d.battTemp / 50) : 0), fill: (t, d) => (isNum(d.battTemp) && d.battTemp > 45 ? t.red : t.ev) }
            : engine || ice
            ? { icon: 0, txt: (d) => C.tempText(o, d.coolant), value: (d) => C.tempFrac(d.coolant), fill: (t, d) => (isNum(d.coolant) && d.coolant >= 118 ? t.red : t.text) }
            : { icon: 6, txt: (d) => (isNum(d.soc) ? Math.round(d.soc) + '%' : '--'), value: (d) => (isNum(d.soc) ? d.soc / 100 : 0), fill: (t) => t.ev };
        const mode = (d) => C.modeText(d, { mode: 'COMFORT' });
        const fuel = () => corner('fuel', -1, (d) => (isNum(d.fuelPct) ? d.fuelPct / 100 : 0), ['0', '1/2', '1'],
            (t, d) => ({ track: t.track, fill0: t.glass1, fill1: t.text, redc: t.red, tip: isNum(d.fuelPct) && d.fuelPct < 12 ? t.red : t.accent, tick: t.tick, num: t.num }));
        const oil = () => corner('oil', 1, (d) => (isNum(d.oil) ? clamp01((d.oil - 50) / 100) : 0), [tempLbl(50), tempLbl(100), tempLbl(150)],
            (t, d) => ({ track: t.track, fill0: isNum(d.oil) && d.oil < 70 ? t.oilCold : t.glass1, fill1: isNum(d.oil) && d.oil >= 130 ? t.red : t.text, redc: t.red, tip: t.accent, tick: t.tick, num: t.num }))
            .concat(C.text('oilUnit', 1792, 500, 50, 24, '°' + (o.tempUnit === 'c' ? 'C' : 'F'), lbl, { align: 0 }), icon('oilIcon', 1790, 532, 30, 1, 'dim'));
        if (map) {
            // with the map: round its window (the stock centre: round its own area, x 566-1104), the rev bar under
            // it, the gear, the speed and the charge on the left, the rows top right, the corners as ever
            const around = o.centre === 'stock' && !strip ? [{ x: 0, y: 0, w: 566, h: 720 }, { x: 1104, y: 0, w: 816, h: 720 }] : C.aroundMap();
            list.splice(0, 1, ...around.map((b, i) => C.flat('bg' + i, b.x, b.y, b.w, b.h, 'bg')));
            if (o.centre === 'map') list.push(revBar(o, C.MAP.x, C.MAP.y + C.MAP.h + 8, C.MAP.w, 28));
            list.push(C.text('gear', 200, 136, 210, 92, C.gearText, (t, d) => ({ color: [C.gearText(d) === 'R' ? t.red : t.text, 1], glow: [t.glow, 0.1] })),
                C.flat('gearRule', 210, 240, 190, 2, 'rule'),
                C.text('speedDigits', 200, 254, 156, 56, (d) => C.speedText(o, d), white, { align: 1 }),
                C.text('speedUnit', 362, 284, 54, 22, C.speedUnit(o), lbl, { align: 0 }),
                ...row('third', 200, 330, 210, third.icon, third.txt, third.value, third.fill),
                ...(strip ? [] : row('mode', 1520, 146, 240, 13, mode, modeLevel, (t) => t.accent)),
                ...row('power', 1520, strip ? 160 : 204, 240, power.icon, power.txt, power.value, power.fill));
        } else {
            // the blades, their scale's unit, the stripes, the gear, the rule and the speed (an M car's KOMBI
            // leaves its boxes in the middle: the gear and the speed below them)
            list.push(...blade(o, -1, 'revL'), ...blade(o, 1, 'revR'),
                C.text('rpmUnit', 1330, 548, 170, 24, (d) => (C.electric(o, d) ? 'kW' : '1/min x1000'), lbl, { align: 0 }),
                stripes(908, 148));
            const gy = mcar ? 404 : 236, gh = mcar ? 100 : 120, ry = gy + gh + 16, sy = ry + 18, sh = mcar ? 64 : 80;
            list.push(C.text('gear', 720, gy, 480, gh, C.gearText, (t, d) => ({ color: [C.gearText(d) === 'R' ? t.red : t.text, 1], glow: [t.glow, 0.1] })),
                C.flat('gearRule', 744, ry, 432, 3, 'rule'), C.flat('gearRuleL', 744, ry - 1, 56, 5, 'text'), C.flat('gearRuleR', 1120, ry - 1, 56, 5, 'text'),
                C.text('speedDigits', 760, sy, 400, sh, (d) => C.speedText(o, d), white, { align: 0.5 }),
                C.text('speedUnit', 1104, sy + sh - 44, 80, 28, C.speedUnit(o), lbl, { align: 0 }),
                ...tyres(o, 262, 200),
                ...(strip ? [] : row('mode', 1440, 150, 300, 13, mode, modeLevel, (t) => t.accent)),
                ...row('power', 1440, strip ? 180 : 208, 300, power.icon, power.txt, power.value, power.fill),
                ...row('third', 1404, 470, 196, third.icon, third.txt, third.value, third.fill));
        }
        // the corners: the fuel (with the car's own strip and the readings in the centre: the strip's gauge
        // instead, layouts.js) and the oil
        if (!(strip && !map)) list.push(...fuel());
        list.push(...oil());
        return list;
    },
    /** (for the tests) */
    _geo: { circle3, angleOf },
};
