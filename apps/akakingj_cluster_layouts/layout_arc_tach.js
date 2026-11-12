'use strict';
/**
 * layout_arc_tach.js - "Arc tach": the engine speed as a wide segmented arc over a large digital speed, its
 * numerals 0 - 7 (Settings > Rev scale) inside the arc, the red zone the shift point's (layout_common.shiftPoint:
 * lower while the oil is cold); the main readout under the speed; a round pod either side (layout_three_pods' pods:
 * the coolant left, the oil right by default, C - H; Readout 1 / 2 in them over the car's own strip).
 * An original design (akakingj's build).
 *
 * The car's own bottom strip (the default): the arc centred, its top clear of the camera's cowl and its ends
 * above the strip, a pod either side. The layout's own strip: the arc left, the pods between it and the KOMBI's
 * gear box (on an M car lower, under its boxes), the ranges right of the box. The map: the arc left of it, a pod
 * right. The stock centre: the arc left, a pod right of the KOMBI's centre.
 */
const C = require('./layout_common');
const TP = require('./layout_three_pods').parts;
const { pod, ranges, lit, lbl, gearC, elecTxt } = TP;

/* Three pods' colours, and the arc's: its unlit segments, the lit ones' gradient and the tip's glow */
const ARC = {
    comfort: { fill0: '#e8ecf0', fill1: '#ffffff', tip: '#ff6a3a', track: '#202226', regen: '#3ddc84' },
    sport: { fill0: '#ffb0a0', fill1: '#ffe4dc', tip: '#ff3a1a', track: '#2a1412', regen: '#3ddc84' },
    efficient: { fill0: '#9fd8ff', fill1: '#e6f6ff', tip: '#2a9fff', track: '#14202a', regen: '#3ddc84' },
};
const PALETTES = Object.fromEntries(Object.keys(TP.PALETTES).map((k) => [k, Object.assign({}, TP.PALETTES[k], ARC[k])]));
const bandColours = (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.minor, num: t.num, neg: t.regen });

/* the arc's sweep: 117 degrees either side of twelve o'clock (its ends a little below its centre) */
const SPAN = 117;
const kwOf = (d) => (C.isNum(d.kw) ? d.kw : 0);
const kwN = (d) => { const r = C.kwRange(d); return { out: Math.ceil(r.out / 30) * 30, in: r.in }; };

/**
 * The arc tach round (cx, cy), radius R (the band's centre line): the band, its numerals inside it, and inside
 * that the gear (withGear: where the KOMBI's strip doesn't show it) or the scale's unit, the digital speed, its
 * unit and the main readout. On a plug-in hybrid in an electric mode the arc reads the battery's power (0 a
 * quarter along, regeneration below it in green), as Modern wide's.
 */
function arcTach(o, cx, cy, R, withGear) {
    const k = R / 320, s = C.rpmScale(o), T = Math.round(40 * k);
    const numH = Math.round(30 * k), numAt = -(T / 2 + Math.round(34 * k));
    // (the layer with room round the band for its glow)
    const pad = Math.round(30 * k), half = R + T / 2 + pad, below = Math.ceil(R * Math.cos((180 - SPAN) * Math.PI / 180) + T / 2 + pad);
    const X = Math.round(cx - half), Y = Math.round(cy - half);
    const evOff = (d) => C.electric(o, d);
    const marks = [s.max, 1, numH, numAt];
    const redSpan = (red) => [-SPAN + 2 * SPAN * Math.min(1, red / s.max), SPAN, 0, 0];
    const list = [
        {
            key: 'rpmArc', kind: 'band', x: X, y: Y, w: Math.round(2 * half), h: Math.round(half + below),
            params: { u_geo: [cx - X, cy - Y, R, T], u_span: [-SPAN, SPAN, s.max * 10, 0.32], u_marks: marks, u_red: [s.red / s.max], u_zero: [0], u_soft: [0.45] },
            colors: (t, d) => (evOff(d) ? Object.assign(bandColours(t), { fill0: t.ev, fill1: t.ev, tip: kwOf(d) < -0.3 ? t.regen : t.ev }) : bandColours(t)),
            value: (d) => (evOff(d) ? C.kwFrac(d.kw, kwN(d)) : C.isNum(d.rpm) ? Math.min(1, d.rpm / 1000 / s.max) : 0), max: 1, sweep: true,
            // (the red zone where the shift point puts it now; on a plug-in hybrid in an electric mode the power's
            // scale, no red zone)
            dyn: (d) => (evOff(d) ? { u_marks: [3, kwN(d).out / 3, numH, numAt], u_red: [2], u_zero: [C.KW_ZERO] }
                : { u_marks: marks, u_red: [Math.min(s.red, C.shiftPoint(o, d).red / 1000) / s.max], u_zero: [0] }),
        },
        {
            // the red zone marked inside the band, lit or not: a thin red arc from where it starts now
            key: 'rpmRedZone', kind: 'band', x: X, y: Y, w: Math.round(2 * half), h: Math.round(half + below),
            params: { u_geo: [cx - X, cy - Y, R - T / 2 - Math.round(8 * k), Math.max(4, Math.round(6 * k))], u_span: redSpan(s.red), u_marks: [0, 0, 0, 0], u_red: [2], u_soft: [1] },
            colors: (t) => ({ track: t.red, fill0: t.red, fill1: t.red, redc: t.red, tip: t.red, tick: t.red, num: t.red }),
            value: () => 1, max: 1,
            dyn: (d) => ({ u_span: redSpan(Math.min(s.red, C.shiftPoint(o, d).red / 1000)) }),
            visible: (d) => !evOff(d),
        },
        C.text('speedDigits', cx - Math.round(170 * k), cy - Math.round(86 * k), Math.round(340 * k), Math.round(150 * k), (d) => C.speedText(o, d), lit),
        C.text('speedDigitsUnit', cx - Math.round(80 * k), cy + Math.round(72 * k), Math.round(160 * k), Math.round(24 * k), C.speedUnit(o), lbl, { tracking: 0.12 }),
        C.text('kwNow', cx - Math.round(130 * k), cy + Math.round(118 * k), Math.round(260 * k), Math.round(40 * k), C.focus.power(o), (t, d) => (C.engineFocus(o) ? lit(t) : kwOf(d) < -0.3 ? { color: [t.regen, 1], glow: [t.regen, 0.3] } : elecTxt(t))),
        C.text('kwNowLbl', cx - Math.round(130 * k), cy + Math.round(162 * k), Math.round(260 * k), Math.round(16 * k), C.focus.powerLabel(o, true), lbl, { tracking: 0.1 }),
    ];
    if (withGear) list.push(C.text('gear', cx - Math.round(60 * k), cy - Math.round(176 * k), Math.round(120 * k), Math.round(66 * k), C.gearText, gearC));
    else list.push(C.text('rpmUnit', cx - Math.round(110 * k), cy - Math.round(140 * k), Math.round(220 * k), Math.round(20 * k), (d) => (evOff(d) ? 'kW' : 'x1000 rpm'), (t, d) => (evOff(d) ? elecTxt(t) : lbl(t)), { tracking: 0.1 }));
    return list;
}

module.exports = {
    id: 'arc_tach',
    title: 'Arc tach',
    palette: (lookId) => PALETTES[lookId] || PALETTES.comfort,
    gearText: C.gearText,

    pieces(o) {
        const bg = [C.flat('bg', 0, 0, 1920, 720, 'bg')];
        if (o.centre === 'map') {
            // the arc left of the map, the right pod right of it (above the KOMBI's gear box without the car's
            // strip); the readouts above the map, the ranges under it
            const top = C.MAP.y, bot = C.MAP.y + C.MAP.h, st = C.strip(o);
            return C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(
                arcTach(o, 208, 430, 160, !st),
                st ? pod(o, 'rpm', 1712, 404, 330, null) : pod(o, 'rpm', 1792, 500, 236, null), [
                    C.text('clock', 520, top - 76, 200, 34, C.clock, lit),
                    C.text('outside', 1200, top - 76, 200, 34, (d) => C.outsideText(o, d.outside), lit),
                ],
                C.readingUp('fuel', 560, bot + 2, 260, 30, (d) => C.distText(o, d.frange), 'FUEL RANGE', lit, lbl),
                C.readingUp('elec', 1100, bot + 2, 300, 30, C.focus.both(o), C.focus.rangeLabel(o), C.engineFocus(o) ? lit : elecTxt, lbl),
            );
        }
        if (C.strip(o)) {
            // over the car's own strip (layout_common.STRIP_Y), which shows the gear and the ranges: the arc
            // centred, its top under the camera's cowl and its ends above the strip, a pod either side
            return bg.concat(arcTach(o, 960, 466, 316, false), pod(o, 'speed', 448, 404, 340, 'clock'), pod(o, 'rpm', 1472, 404, 340, 'outside'));
        }
        if (o.centre === 'stock') {
            // the KOMBI's own centre between: the arc left, the right pod right of it, the ranges right of the box
            return [C.flat('bg', 0, 0, 566, 720, 'bg'), C.flat('bgR', 1104, 0, 816, 720, 'bg')].concat(
                arcTach(o, 284, 430, 228, true), C.mCar(o) ? [] : pod(o, 'rpm', 1256, 392, 280, null), ranges(o));   // (an M car: its second box there)
        }
        // the layout's own strip: the arc left, the pods between it and the KOMBI's gear box (an M car: lower,
        // under the M KOMBI's two boxes), the ranges right of the box
        const m = C.mCar(o);
        return bg.concat(arcTach(o, 470, 440, 288, true),
            m ? pod(o, 'speed', 916, 540, 200, 'clock') : pod(o, 'speed', 960, 410, 290, 'clock'),
            m ? pod(o, 'rpm', 1311, 556, 186, 'outside') : pod(o, 'rpm', 1262, 410, 270, 'outside'),
            ranges(o));
    },
};
