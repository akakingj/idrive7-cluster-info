'use strict';
/**
 * layout_three_pods.js - "Three pods": a big rev counter in the middle with the digital speed set in its face,
 * and a round pod either side of it, each one gauge (the coolant left, the oil right by default; Settings >
 * Small gauge in the speedometer / in the tach pick another) with a readout under its pivot. Separate pods with
 * satin rims, the tach's numerals 0 - 7 (Settings > Rev scale), its red zone the shift point's (layout_common
 * .shiftPoint). An original design (akakingj's build).
 *
 * The car's own bottom strip (the default): the three pods centred above it. The layout's own strip: the tach
 * and the left pod left of the KOMBI's gear box, the right pod between them and the box, the ranges right of
 * it. The map in the centre: the tach left of the map, the right pod right of it. The stock centre: the tach
 * left, the right pod right of the KOMBI's centre.
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
 * The rev counter, size S centred (cx, cy): numerals 0 - 7, its red zone, and in its face the digital speed
 * (with the gear above the pivot where the KOMBI's strip doesn't show it) and the main readout in the gap at its
 * foot (Settings > Centre readout: under the speed).
 */
function tach(o, cx, cy, S, withGear) {
    const k = S / 640, s = C.rpmScale(o), red = s.red;
    const X = cx - S / 2, Y = cy - S / 2;
    const list = [
        {
            key: 'rpm', kind: 'dial', x: X, y: Y, w: S, h: S,
            params: { u_scale: [s.max, s.major, s.minor, red], u_arc: [-135, 135, Math.round(50 * k + 2), 218 * k], u_needle_dim: [272 * k, 46 * k, 16 * k, 5], u_look: [0.9, 0.85, 0, 0], u_look2: [Math.round(16 * k), k, 0.85, 1] },
            colors: dialColours, max: s.max, sweep: true, value: C.tachValue(o), range: C.tachRange(o, s), dyn: C.tachDyn(o, s, red),
        },
        C.text('rpmUnit', cx - 110, cy - Math.round(156 * k), 220, Math.round(19 * k), (d) => (C.electric(o, d) ? C.kwText(d) : 'x1000 rpm'), (t, d) => (C.electric(o, d) ? elecTxt(t) : lbl(t)), { tracking: 0.1 }),
        // the digital speed, under the pivot
        C.text('speedDigits', cx - 130, cy + Math.round(52 * k), 260, Math.round(104 * k), (d) => C.speedText(o, d), lit),
        C.text('speedDigitsUnit', cx - 80, cy + Math.round(160 * k), 160, Math.round(20 * k), C.speedUnit(o), lbl, { tracking: 0.12 }),
        // the main readout in the gap at the foot of the scale
        C.text('kwNow', cx - 110, cy + Math.round(206 * k), 220, Math.round(36 * k), C.focus.power(o), (t, d) => (C.engineFocus(o) ? lit(t) : C.isNum(d.kw) && d.kw < -0.3 ? { color: ['#3ddc84', 1], glow: ['#3ddc84', 0.3] } : elecTxt(t))),
        C.text('kwNowLbl', cx - 110, cy + Math.round(246 * k), 220, Math.round(15 * k), C.focus.powerLabel(o, true), lbl, { tracking: 0.1 }),
    ];
    if (withGear) list.push(C.text('gear', cx - 60, cy - Math.round(124 * k), 120, Math.round(62 * k), C.gearText, gearC));
    return list;
}

/**
 * A side pod, size S centred (cx, cy): one gauge across its top (Settings > Small gauge in the speedometer for the
 * left, in the tach for the right; else the coolant, the oil), C - H for a temperature (Settings > Temperature
 * gauges), its name under the pivot, and under that a readout (`readKey`: the time's or the outside
 * temperature's place, layouts.js puts Readout 1 / 2 there over the car's own strip).
 */
function pod(o, which, cx, cy, S, readKey) {
    const k = S / 360, temp = which === 'speed' ? 'coolant' : 'oil', tempRed = C.hotAt(o, temp);
    const g = C.gaugeOf(o, which), tk = g ? g.key : temp, ch = C.chOf(o, tk);
    const list = [
        {
            key: temp + 'Dial', kind: 'dial', x: cx - S / 2, y: cy - S / 2, w: S, h: S,
            params: { u_scale: [100, 50, 12.5, ch ? C.chRed(o, ch) * 100 : g ? Math.min(101, g.redFrac * 100) : tempRed - 40], u_arc: [-110, 110, 0, 0], u_needle_dim: [128 * k, 26 * k, 10 * k, 3.5], u_look: [0.85, 0.85, 0, 0], u_look2: [Math.max(5, Math.round(11 * k)), S / 640, 0.75, 0.8] },
            colors: dialColours, value: ch ? (d) => C.chFrac(ch, d[ch]) * 100 : g ? (d) => g.frac(d) * 100 : (d) => (C.isNum(d[temp]) ? Math.max(0, d[temp] - 40) : 0), max: 100, sweep: true,
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

module.exports = {
    id: 'three_pods',
    title: 'Three pods',
    palette: (lookId) => PALETTES[lookId] || PALETTES.comfort,
    gearText: C.gearText,

    pieces(o) {
        const bg = [C.flat('bg', 0, 0, 1920, 720, 'bg')];
        if (o.centre === 'map') {
            // the tach left of the map, the right pod right of it (above the KOMBI's gear box without the car's strip);
            // the readouts above the map, the ranges under it
            const top = C.MAP.y, bot = C.MAP.y + C.MAP.h, st = C.strip(o);
            return C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(
                tach(o, 208, 404, 360, !st),
                st ? pod(o, 'rpm', 1712, 404, 330, null) : pod(o, 'rpm', 1792, 500, 236, null), [
                    C.text('clock', 520, top - 76, 200, 34, C.clock, lit),
                    C.text('outside', 1200, top - 76, 200, 34, (d) => C.outsideText(o, d.outside), lit),
                ],
                C.readingUp('fuel', 560, bot + 2, 260, 30, (d) => C.distText(o, d.frange), 'FUEL RANGE', lit, lbl),
                C.readingUp('elec', 1100, bot + 2, 300, 30, C.focus.both(o), C.focus.rangeLabel(o), C.engineFocus(o) ? lit : elecTxt, lbl),
            );
        }
        if (C.strip(o)) {
            // over the car's own strip (layout_common.STRIP_Y), which shows the gear and the ranges: the three pods
            // centred above it, the tach's top clear of the camera's cowl; the fuel gauge above the strip's range
            return bg.concat(tach(o, 960, 390, 496, false), pod(o, 'speed', 520, 404, 352, 'clock'), pod(o, 'rpm', 1400, 404, 352, 'outside'));
        }
        if (o.centre === 'stock') {
            // the KOMBI's own centre between: the tach left, the right pod right of it, the ranges right of the box
            return [C.flat('bg', 0, 0, 566, 720, 'bg'), C.flat('bgR', 1104, 0, 816, 720, 'bg')].concat(
                tach(o, 300, 392, 520, true), C.mCar(o) ? [] : pod(o, 'rpm', 1256, 392, 280, null), ranges(o));   // (an M car: its second box there)
        }
        // the layout's own strip: the tach left of the KOMBI's gear box, the left pod left of it, the right pod
        // between it and the box, the ranges right of the box
        // (an M car: the tach left, clear of the M KOMBI's two boxes, which would sit on its face; the pods lower,
        // under the boxes, as Arc tach's)
        if (C.mCar(o)) return bg.concat(tach(o, 420, 392, 500, true), pod(o, 'speed', 916, 540, 200, 'clock'), pod(o, 'rpm', 1311, 556, 186, 'outside'), ranges(o));
        return bg.concat(tach(o, 880, 392, 500, true), pod(o, 'speed', 404, 404, 330, 'clock'), pod(o, 'rpm', 1270, 392, 260, 'outside'), ranges(o));
    },
};

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

/** (shared with layout_arc_tach.js: its side pods and ranges are these) */
module.exports.parts = { PALETTES, pod, ranges, lit, lbl, gearC, elecTxt };
