'use strict';
/**
 * pods.js - Arc tach's parts (from the Three pods layout, removed in akakingj's build): its colours, a round side
 * pod (one gauge across its top, C - H for a temperature, its name and a readout under the pivot) and the ranges right
 * of the KOMBI's gear box. An original design (akakingj's build).
 */
const C = require('./layout_common');

const PALETTES = {
    comfort: {
        bg: '#000000', face0: '#121315', face1: '#040405', bezel: '#c9ccd1', bezel2: '#34363a', tick: '#f4f6f8', minor: '#8c9298',
        num: '#f4f6f8', glow: '#ff3a1a', red: '#ff2a1a', needle: '#ff2a14', hub: '#121314', accent: '#ff3a1a',
        text: '#f4f6f8', dim: '#9aa2aa', track: '#1a1c1f', ev: '#4ab4ff', lcdEdge: '#2c2f33',
    },
    sport: {
        bg: '#000000', face0: '#160d0c', face1: '#050303', bezel: '#d8cfcd', bezel2: '#3b3130', tick: '#ffffff', minor: '#b0807a',
        num: '#ffd2c8', glow: '#ff2414', red: '#ff2414', needle: '#ff2414', hub: '#150f0e', accent: '#ff2414',
        text: '#ffd2c8', dim: '#c09a94', track: '#1f0e0c', ev: '#4ab4ff', lcdEdge: '#3a2826',
    },
    efficient: {
        bg: '#000000', face0: '#0d1317', face1: '#030506', bezel: '#c6d0d6', bezel2: '#2c3438', tick: '#eaf6ff', minor: '#6f8a99',
        num: '#bfe6ff', glow: '#2a9fff', red: '#ff3a1a', needle: '#ff5a1c', hub: '#0f1416', accent: '#2a9fff',
        text: '#bfe6ff', dim: '#9aaab4', track: '#0a141a', ev: '#4ab4ff', lcdEdge: '#24323a',
    },
};
const dialColours = (t) => ({ face0: t.face0, face1: t.face1, bezel: t.bezel, bezel2: t.bezel2, tick: t.tick, minor: t.minor, num: t.num, red: t.red, needle: t.needle, hub: t.hub, accent: t.accent, glow: t.glow });
const lit = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.35] });
const lbl = (t) => ({ color: [t.dim, 1], glow: [t.glow, 0.2] });
const gearC = (t, d) => ({ color: [C.gearText(d) === 'R' ? t.red : t.text, 1], glow: [t.glow, 0.4] });
const elecTxt = (t) => ({ color: [t.ev, 1], glow: [t.ev, 0.3] });

/**
 * A side pod, size S centred (cx, cy): one gauge across its top (Settings > Small gauge in the speedometer for the
 * left, in the tach for the right; else the coolant, the oil), C - H for a temperature (Settings > Temperature
 * gauges), its name under the pivot, and under that a readout (`readKey`: the time's or the outside
 * temperature's place, layouts.js puts Readout 1 / 2 there over the car's own strip). bare: no rim of its own and
 * its face the background's (Arc tach's joined circles draw the rim round it: layout_arc_tach.js rims).
 */
function pod(o, which, cx, cy, S, readKey, bare) {
    const k = S / 360, temp = which === 'speed' ? 'coolant' : 'oil', tempRed = C.hotAt(o, temp);
    const g = C.gaugeOf(o, which), tk = g ? g.key : temp, ch = C.chOf(o, tk);
    const list = [
        {
            key: temp + 'Dial', kind: 'dial', x: cx - S / 2, y: cy - S / 2, w: S, h: S,
            params: { u_scale: [100, 50, 12.5, ch ? C.chRed(o, ch) * 100 : g ? Math.min(101, g.redFrac * 100) : tempRed - 40], u_arc: [-110, 110, 0, 0], u_needle_dim: [128 * k, 26 * k, 10 * k, 3.5], u_look: [0.85, 0.85, 0, 0], u_look2: bare ? [0, S / 640, 0, 0] : [Math.max(5, Math.round(11 * k)), S / 640, 0.75, 0.8] },
            colors: bare ? (t) => Object.assign(dialColours(t), { face0: t.bg, face1: t.bg }) : dialColours, value: ch ? (d) => C.chFrac(ch, d[ch]) * 100 : g ? (d) => g.frac(d) * 100 : (d) => (C.isNum(d[temp]) ? Math.max(0, d[temp] - 40) : 0), max: 100, sweep: true,
        },
        C.text(temp + 'Lbl', cx - 80, cy + Math.round(30 * k), 160, Math.round(17 * k), g ? g.label : temp === 'oil' ? 'OIL' : 'COOLANT', lbl, { tracking: 0.16 }),
    ];
    if (ch) list.push(...C.chMarks(temp + 'Ch', cx, cy, S * 0.34, -104, 104, Math.max(14, Math.round(22 * k)), lit));
    else list.push(C.text(temp + 'Num', cx - 80, cy + Math.round(56 * k), 160, Math.round(28 * k), g ? g.txt : (d) => C.tempText(o, d[temp]), lit));
    if (readKey) {
        const txt = readKey === 'clock' ? C.clock : (d) => C.outsideText(o, d.outside);
        list.push(C.text(readKey, cx - Math.round(110 * k), cy + Math.round(98 * k), Math.round(220 * k), Math.round(28 * k), txt, lit));
    }
    return list;
}

/** Right of the KOMBI's gear box (the layout's own strip): the fuel and electric ranges, the charge. */
function ranges(o) {
    const RX = 1672, RW = 216;
    return [
        ...C.reading('fuel', RX, 292, RW, 44, (d) => C.distText(o, d.frange), 'FUEL RANGE', lit, lbl),
        ...C.reading('elec', RX, 400, RW, 44, C.focus.range(o), C.focus.rangeLabel(o), C.engineFocus(o) ? lit : elecTxt, lbl),
        C.text('socTxt', RX, 506, RW, 44, C.focus.charge(o), C.engineFocus(o) ? lit : elecTxt),
        C.bar('soc', RX + 8, 562, RW - 16, 16, C.focus.bar(o), (t) => ({ track: t.track, fill0: C.engineFocus(o) ? t.accent : t.ev, fill1: C.engineFocus(o) ? t.accent : t.ev, redc: t.red, tip: t.glow, tick: t.dim, num: t.num }), 16),
    ];
}

module.exports = { PALETTES, dialColours, pod, ranges, lit, lbl, gearC, elecTxt };
