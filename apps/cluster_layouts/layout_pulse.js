'use strict';
/**
 * layout_pulse.js - "Pulse": made for the car's own bottom strip (the layout ends at y 660). The speed stands
 * large in the middle, under the camera's cowl, with the gear beside it; one long segmented bar under them is the
 * engine speed, running nearly the panel's width and turning red at the redline. A slim row of readings sits
 * along the bottom (oil, coolant, fuel and electric range, charge, power), the time and outside temperature in
 * the top corners. Its colours follow the
 * drive mode. An original design.
 */
const C = require('./layout_common');

const PALETTES = {
    comfort: {
        bgTop: '#0a0f16', bgBottom: '#020305', track: '#141c26', fill0: '#2b6fd6', fill1: '#7fd0ff', tip: '#d8f2ff',
        red: '#ff4038', tick: '#3a4a5c', num: '#93a7bc', text: '#f4f8ff', glow: '#4aa8ff', dim: '#8d99a6', rule: '#1b2836', ev: '#4ab4ff',
        mode: 'COMFORT',
    },
    sport: {
        bgTop: '#130808', bgBottom: '#040202', track: '#261515', fill0: '#c2410c', fill1: '#ffb020', tip: '#fff1c8',
        red: '#ff2a2a', tick: '#5a3a30', num: '#d6b0a0', text: '#ffffff', glow: '#ff7a1a', dim: '#b8a49c', rule: '#3a1d16', ev: '#4ab4ff',
        mode: 'SPORT',
    },
    efficient: {
        bgTop: '#05110e', bgBottom: '#010403', track: '#10221d', fill0: '#0f8a68', fill1: '#5ef2c4', tip: '#d4fff1',
        red: '#ff4038', tick: '#2c4d45', num: '#98c4b8', text: '#effffa', glow: '#2ad6a6', dim: '#93aba5', rule: '#153a31', ev: '#2ad6a6',
        mode: 'EFFICIENT',
    },
};
const big = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.5] });
const txt = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.12] });
const evTxt = (t) => ({ color: [t.ev, 1], glow: [t.ev, 0.3] });
const lbl = (t) => ({ color: [t.dim, 1], glow: [t.glow, 0] });
const accent = (t) => ({ color: [t.glow, 1], glow: [t.glow, 0.6] });
const bg = (key, x, y, w, h) => ({ key, kind: 'panel', x, y, w, h, params: { u_box: [0, 0, 0, 1] }, colors: (t) => ({ top: t.bgTop, bottom: t.bgBottom, border: t.bgBottom }) });
const hotC = (k, lim) => (t, d) => ({ color: [C.isNum(d[k]) && d[k] >= lim ? '#ff3b30' : t.text, 1], glow: [t.glow, 0] });
const gearC = (t, d) => ({ color: [C.gearText(d) === 'R' ? '#ff3b30' : t.text, 1], glow: [t.glow, 0.5] });
const rpmTxt = (d) => (C.isNum(d.rpm) ? Math.round(d.rpm / 50) * 50 + ' RPM' : '-- RPM');

/** The engine speed as a long segmented bar, red from the redline. */
function rpmBar(o, key, x, y, w, h, segments) {
    const r = C.rpmScale(o);
    return { key, kind: 'band', x, y, w, h,
        params: { u_geo: [6, h / 2, 0, Math.max(6, h - 10)], u_span: [0, 0, segments, 0.28], u_marks: [0, 0, 0, 0], u_red: [r.red / r.max] },
        colors: (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.tick, num: t.num }),
        value: (d) => (C.isNum(d.rpm) ? d.rpm / 1000 / r.max : 0), max: 1, sweep: true };
}
const socBar = (o, key, x, y, w, h) => C.bar(key, x, y, w, h, C.focus.bar(o), (t) => {
    const f = C.engineFocus(o) ? t.fill1 : t.ev;
    return { track: t.track, fill0: f, fill1: f, redc: t.red, tip: t.tip, tick: t.dim, num: t.num };
}, 20);

module.exports = {
    id: 'pulse',
    title: 'Pulse',
    palette: (lookId) => PALETTES[lookId] || PALETTES.comfort,
    gearText: C.gearText,

    pieces(o) {
        const eTxt = C.engineFocus(o) ? txt : evTxt;
        if (o.centre === 'map') {
            // the speed on the left of the map, the gear on the right (past the KOMBI's gear box); the engine speed along under the map
            const bot = C.MAP.y + C.MAP.h;
            return C.aroundMap().map((b, i) => bg('bg' + i, b.x, b.y, b.w, b.h)).concat([
                C.text('clock', 120, 176, 260, 34, C.clock, txt),
                C.text('speedDigits', 60, 230, 340, 130, (d) => C.speedText(o, d), big),
                C.text('speedUnit', 60, 366, 340, 22, C.speedUnit(o), lbl, { tracking: 0.25 }),
                C.text('outside', 120, 520, 260, 34, (d) => C.outsideText(o, d.outside), txt),
                C.text('gear', 1670, 290, 230, 130, C.gearText, gearC),
                C.text('mode', 1670, 428, 230, 20, C.modeText, accent, { tracking: 0.3 }),
                rpmBar(o, 'rpmBar', C.MAP.x, bot + 8, C.MAP.w, 26, 48),
            ],
            C.readingUp('fuel', 60, 590, 160, 28, (d) => C.distText(o, d.frange), 'FUEL', txt, lbl),
            C.readingUp('elec', 230, 590, 170, 28, C.focus.range(o), C.focus.rangeLabel(o), eTxt, lbl),
            C.readingUp('oil', 1520, 520, 180, 28, (d) => C.tempText(o, d.oil), 'OIL', hotC('oil', 130), lbl),
            C.readingUp('coolant', 1710, 520, 180, 28, (d) => C.tempText(o, d.coolant), 'COOLANT', hotC('coolant', 118), lbl),
            C.readingUp('kw', 1520, 590, 180, 28, C.focus.power(o), C.focus.powerLabel(o), txt, lbl),
            C.readingUp('soc', 1710, 590, 180, 28, C.focus.charge(o), C.focus.chargeLabel(o), eTxt, lbl));
        }
        if (o.centre === 'stock') {
            // the stock centre between two panels: the speed and its bar on the left, the gear and readings on the right
            return [bg('bg', 0, 0, 640, 720), bg('bgR', 1280, 0, 640, 720),
                C.text('clock', 250, 150, 170, 34, C.clock, txt),
                C.text('outside', 430, 150, 170, 34, (d) => C.outsideText(o, d.outside), txt),
                C.text('speedDigits', 160, 220, 440, 170, (d) => C.speedText(o, d), big),
                C.text('speedUnit', 160, 396, 440, 22, C.speedUnit(o), lbl, { tracking: 0.25 }),
                rpmBar(o, 'rpmBar', 120, 450, 500, 26, 24),
                C.text('rpmDigits', 120, 486, 500, 20, rpmTxt, lbl, { tracking: 0.12 }),
                C.text('gear', 1680, 290, 220, 140, C.gearText, gearC),
                C.text('mode', 1680, 436, 220, 20, C.modeText, accent, { tracking: 0.3 }),
            ].concat(
                C.readingUp('oil', 120, 560, 240, 34, (d) => C.tempText(o, d.oil), 'OIL', hotC('oil', 130), lbl),
                C.readingUp('coolant', 380, 560, 240, 34, (d) => C.tempText(o, d.coolant), 'COOLANT', hotC('coolant', 118), lbl),
                C.readingUp('fuel', 1300, 500, 300, 34, (d) => C.distText(o, d.frange), 'FUEL RANGE', txt, lbl),
                C.readingUp('elec', 1610, 500, 300, 34, C.focus.range(o), C.focus.rangeLabel(o), eTxt, lbl),
                C.readingUp('kw', 1300, 576, 300, 34, C.focus.power(o), C.focus.powerLabel(o), txt, lbl),
                C.readingUp('soc', 1610, 576, 300, 34, C.focus.charge(o), C.focus.chargeLabel(o), eTxt, lbl));
        }
        return [bg('bg', 0, 0, 1920, 720),
            // the time and outside temperature in the top corners, inside the glass's slant
            C.text('clock', 300, 140, 220, 40, C.clock, txt),
            C.text('outside', 1400, 140, 220, 40, (d) => C.outsideText(o, d.outside), txt),
            C.text('mode', 760, 140, 400, 22, C.modeText, accent, { tracking: 0.35 }),
            // the speed, large, in the middle; the gear to its left (the KOMBI's gear box is on the right)
            C.text('speedDigits', 720, 180, 480, 230, (d) => C.speedText(o, d), big),
            C.text('speedUnit', 720, 414, 480, 24, C.speedUnit(o), lbl, { tracking: 0.3 }),
            C.text('gear', 400, 230, 280, 170, C.gearText, gearC),
            C.text('rpmDigits', 1220, 330, 180, 22, rpmTxt, lbl, { tracking: 0.1 }),
            // the engine speed: one long bar under it all
            rpmBar(o, 'rpmBar', 220, 470, 1480, 30, 64),
            C.flat('rule', 220, 532, 1480, 2, 'rule'),
        ].concat(
            // one slim row along the bottom, the charge bar under its charge
            C.readingUp('oil', 220, 560, 230, 40, (d) => C.tempText(o, d.oil), 'OIL', hotC('oil', 130), lbl),
            C.readingUp('coolant', 470, 560, 230, 40, (d) => C.tempText(o, d.coolant), 'COOLANT', hotC('coolant', 118), lbl),
            C.readingUp('fuel', 720, 560, 230, 40, (d) => C.distText(o, d.frange), 'FUEL RANGE', txt, lbl),
            C.readingUp('elec', 970, 560, 230, 40, C.focus.range(o), C.focus.rangeLabel(o), eTxt, lbl),
            C.readingUp('soc', 1220, 560, 230, 40, C.focus.charge(o), C.focus.chargeLabel(o), eTxt, lbl),
            [socBar(o, 'socBar', 1250, 624, 170, 18)],
            C.readingUp('kw', 1470, 560, 230, 40, C.focus.power(o), C.focus.powerLabel(o), txt, lbl));
    },
};
