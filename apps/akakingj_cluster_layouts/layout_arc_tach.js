'use strict';
/**
 * layout_arc_tach.js - "Arc tach": the engine speed as a solid arc, filling as it climbs, three quarters round (from six o'clock up
 * the left, over the top, down to three o'clock), its numerals 0 - 7 (Settings > Rev scale) inside it, the red
 * zone the shift point's (layout_common.shiftPoint: lower while the oil is cold) at its end; the digital speed in
 * the quarter it leaves open, under the red end; the main readout inside the arc; a round pod either side
 * (pods.js: the coolant left, the oil right by default, C - H; Readout 1 / 2 in them over the car's
 * own strip). An original design (akakingj's build).
 *
 * The car's own bottom strip (the default): the arc and the speed in the middle, its top clear of the camera's cowl
 * and its foot above the strip, a pod either side, the three joined: each circle's rim cut where the next one's
 * meets it, one outline round them (rims). The layout's own strip: the arc left, the two pods joined on to it in
 * a row up to the KOMBI's gear box (an M car: apart, lower, under its boxes), the ranges right of the box. The map:
 * the arc left of it, a pod right. The stock centre: the arc left, a pod right of the KOMBI's centre.
 */
const C = require('./layout_common');
const TP = require('./pods');
const { pod, ranges, lit, lbl, gearC, elecTxt } = TP;

/* the pods' colours (pods.js), and the arc's: its unlit track, the lit part's gradient and the tip's glow */
const ARC = {
    comfort: { fill0: '#e8ecf0', fill1: '#ffffff', tip: '#ff6a3a', track: '#202226', regen: '#3ddc84' },
    sport: { fill0: '#ffb0a0', fill1: '#ffe4dc', tip: '#ff3a1a', track: '#2a1412', regen: '#3ddc84' },
    efficient: { fill0: '#9fd8ff', fill1: '#e6f6ff', tip: '#2a9fff', track: '#14202a', regen: '#3ddc84' },
};
// (no Object.fromEntries: the head unit's Node is 8)
const PALETTES = Object.keys(TP.PALETTES).reduce((o, k) => { o[k] = Object.assign({}, TP.PALETTES[k], ARC[k]); return o; }, {});
const bandColours = (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.minor, num: t.num, neg: t.regen });

/* the arc's sweep: three quarters of a circle, from (just left of) six o'clock up the left, over the top and
 * down to three o'clock, where the red zone ends; the quarter it leaves open, under that end, holds the digital speed */
const A0 = -170, A1 = 90;   // (its foot a little left of six o'clock: the shader's angles wrap at six)
const kwOf = (d) => (C.isNum(d.kw) ? d.kw : 0);
const kwN = (d) => { const r = C.kwRange(d); return { out: Math.ceil(r.out / 30) * 30, in: r.in }; };

/**
 * The arc tach round (cx, cy), radius R (the band's centre line): the band, its numerals inside it; in the
 * quarter it leaves open (bottom right, under the red end) the digital speed and its unit, `room` px right of cx
 * for them; inside the arc the gear (withGear: where the KOMBI's strip doesn't show it) or the scale's unit, and
 * the main readout. On a plug-in hybrid in an electric mode the arc reads the battery's power (0 a quarter along,
 * regeneration below it in green), as Modern wide's.
 */
function arcTach(o, cx, cy, R, withGear, room, inside) {
    const k = R / 240, s = C.rpmScale(o), T = Math.round(30 * k);
    const numH = Math.round(32 * k), numAt = -(T / 2 + Math.round(32 * k));
    // (the layer square round the circle, with room round the band for its glow)
    // (cut at the car's own strip's line: only its glow's edge reached below it, over the strip and the warning
    // lights)
    const half = Math.round(R + T / 2 + 30 * k), X = Math.round(cx - half), Y = Math.round(cy - half), H = Math.min(2 * half, C.STRIP_Y - Y);
    const evOff = (d) => C.electric(o, d);
    const marks = [s.max, 1, numH, numAt];
    const redSpan = (red) => [A0 + (A1 - A0) * Math.min(1, red / s.max), A1, 0, 0];
    // the red zone's strip: where it starts now (the shift point's), shown only while it has a length (none with the
    // red line at the scale's end: a zero sweep would divide by zero in the shader); its layer just round the part
    // of the circle it can reach (from where the coldest oil puts it, layout_common.shiftPoint at 30 °C)
    const redNow = (d) => Math.min(s.red, C.shiftPoint(o, d).red / 1000);
    const rr = R - T / 2 - Math.round(8 * k), rw = Math.max(4, Math.round(6 * k));
    const aLow = redSpan(Math.min(s.red, C.shiftPoint(o, { oil: 30 }).red / 1000))[0];
    const xs = [], ys = [];
    for (let a = aLow; a <= A1 + 0.01; a += Math.max(0.5, (A1 - aLow) / 64)) for (const r of [rr - rw, rr + rw]) { xs.push(cx + r * Math.sin(a * Math.PI / 180)); ys.push(cy - r * Math.cos(a * Math.PI / 180)); }
    const RX = Math.floor(Math.min(...xs) - 6), RY = Math.floor(Math.min(...ys) - 6), RW = Math.ceil(Math.max(...xs) + 6) - RX, RH = Math.ceil(Math.max(...ys) + 6) - RY;
    const sx = cx + Math.round(0.04 * R), sw = Math.round(room - 0.04 * R);
    // (inside: the speed within the circle round the arc, smaller - joined, a rim round it)
    const sy = inside ? [0.2, 0.42, 0.66, 0.08] : [0.12, 0.72, 0.86, 0.1];
    const list = [
        {
            key: 'rpmArc', kind: 'band', x: X, y: Y, w: 2 * half, h: H,
            params: { u_geo: [cx - X, cy - Y, R, T], u_span: [A0, A1, 0, 0], u_marks: marks, u_red: [s.red / s.max], u_zero: [0], u_soft: [0.45] },
            colors: (t, d) => (evOff(d) ? Object.assign(bandColours(t), { fill0: t.ev, fill1: t.ev, tip: kwOf(d) < -0.3 ? t.regen : t.ev }) : bandColours(t)),
            value: (d) => (evOff(d) ? C.kwFrac(d.kw, kwN(d)) : C.isNum(d.rpm) ? Math.min(1, d.rpm / 1000 / s.max) : 0), max: 1, sweep: true,
            // (the red zone where the shift point puts it now; on a plug-in hybrid in an electric mode the power's
            // scale, no red zone)
            dyn: (d) => (evOff(d) ? { u_marks: [3, kwN(d).out / 3, numH, numAt], u_red: [2], u_zero: [C.KW_ZERO] }
                : { u_marks: marks, u_red: [Math.min(s.red, C.shiftPoint(o, d).red / 1000) / s.max], u_zero: [0] }),
        },
        {
            // the red zone marked inside the band, lit or not: a thin red arc from where it starts now
            key: 'rpmRedZone', kind: 'band', x: RX, y: RY, w: RW, h: RH,
            params: { u_geo: [cx - RX, cy - RY, rr, rw], u_span: redSpan(s.red), u_marks: [0, 0, 0, 0], u_red: [2], u_soft: [1] },
            colors: (t) => ({ track: t.red, fill0: t.red, fill1: t.red, redc: t.red, tip: t.red, tick: t.red, num: t.red }),
            value: () => 1, max: 1,
            dyn: (d) => { const sp = redSpan(redNow(d)); return { u_span: sp[1] - sp[0] >= 1 ? sp : [A1 - 1, A1, 0, 0] }; },
            visible: (d) => !evOff(d) && redNow(d) < s.max - 0.01,
        },
        // the digital speed in the open quarter, under the arc's red end
        C.text('speedDigits', sx, cy + Math.round(sy[0] * R), sw, Math.round(sy[1] * R), (d) => C.speedText(o, d), lit),
        C.text('speedDigitsUnit', sx, cy + Math.round(sy[2] * R), sw, Math.round(sy[3] * R), C.speedUnit(o), lbl, { tracking: 0.12 }),
        // the main readout inside the arc, at its middle
        C.text('kwNow', cx - Math.round(0.55 * R), cy - Math.round(0.16 * R), Math.round(1.1 * R), Math.round(0.24 * R), C.focus.power(o), (t, d) => (C.engineFocus(o) ? lit(t) : kwOf(d) < -0.3 ? { color: [t.regen, 1], glow: [t.regen, 0.3] } : elecTxt(t))),
        C.text('kwNowLbl', cx - Math.round(0.5 * R), cy + Math.round(0.11 * R), Math.round(R), Math.round(0.075 * R), C.focus.powerLabel(o, true), lbl, { tracking: 0.1 }),
    ];
    // (the gear: Settings > Arc tach: the gear in the arc; not twice, with the gear as the main readout too)
    if (withGear) { if (o.arcGear !== 'off' && o.infoMain !== 'gear') list.push(C.text('gear', cx - Math.round(0.25 * R), cy - Math.round(0.5 * R), Math.round(0.5 * R), Math.round(0.26 * R), C.gearText, gearC)); }
    else list.push(C.text('rpmUnit', cx - Math.round(0.4 * R), cy - Math.round(0.4 * R), Math.round(0.8 * R), Math.round(0.08 * R), (d) => (evOff(d) ? 'kW' : 'x1000 rpm'), (t, d) => (evOff(d) ? elecTxt(t) : lbl(t)), { tracking: 0.1 }));
    return list;
}

/**
 * The rims of circles joined in a row: [{ x, y, r }] (r: the rim's middle line), each drawn as a thin satin band
 * all round but where another of them overlaps it, so where two meet their rims end on each other in a point and
 * one outline goes round them all. Thickness w px.
 */
function rims(circles, w) {
    const out = [];
    const wrap = (a) => ((a + 540) % 360) - 180;
    circles.forEach((c, i) => {
        // the gaps: towards each circle that overlaps this one, as wide as the overlap's chord
        const gaps = [];
        circles.forEach((e, j) => {
            if (i === j) return;
            const D = Math.hypot(e.x - c.x, e.y - c.y);
            if (!(D < c.r + e.r && D > Math.abs(c.r - e.r))) return;
            const half = Math.acos((D * D + c.r * c.r - e.r * e.r) / (2 * D * c.r)) * 180 / Math.PI;
            gaps.push({ at: Math.atan2(e.x - c.x, -(e.y - c.y)) * 180 / Math.PI, half });
        });
        const open = (a) => gaps.every((g) => Math.abs(wrap(a - g.at)) > g.half);
        // the arcs left, each within -180 .. 180 (the band's angles wrap at six o'clock)
        const runs = [];
        let from = null;
        for (let a = -180; a <= 180.001; a += 0.25) {
            if (open(a) && a < 180) { if (from === null) from = a; continue; }
            if (from !== null && a - from >= 1) runs.push([from, Math.min(180, a)]);
            from = null;
        }
        runs.forEach((sp, n) => {
            const xs = [], ys = [];
            for (let a = sp[0]; a <= sp[1] + 0.01; a += Math.max(0.5, (sp[1] - sp[0]) / 48)) {
                for (const r of [c.r - w, c.r + w]) { xs.push(c.x + r * Math.sin(a * Math.PI / 180)); ys.push(c.y - r * Math.cos(a * Math.PI / 180)); }
            }
            const X = Math.floor(Math.min(...xs) - 4), Y = Math.floor(Math.min(...ys) - 4);
            const W = Math.ceil(Math.max(...xs) + 4) - X, H = Math.min(C.STRIP_Y, Math.ceil(Math.max(...ys) + 4)) - Y;
            if (H <= 0) return;
            out.push({
                key: 'rim' + i + '_' + n, kind: 'band', x: X, y: Y, w: W, h: H,
                params: { u_geo: [c.x - X, c.y - Y, c.r, w], u_span: [sp[0], sp[1], 0, 0], u_marks: [0, 0, 0, 0], u_red: [2], u_zero: [0], u_soft: [1] },
                colors: (t) => ({ track: t.bezel2, fill0: t.bezel, fill1: t.bezel, redc: t.bezel, tip: t.bezel2, tick: t.bezel, num: t.bezel }),
                value: () => 1, max: 1,
            });
        });
    });
    return out;
}

/**
 * The arc, its circle's rim and pods joined on to it in a row (rims): the arc round (cx, cy), radius R (its band's
 * middle line); then each pod [which, readKey, rim radius], left (side -1) or right (+1) of the one before, its
 * rim overlapping that one's by `bite` px. A pod's dial sits inside its rim clear of the overlap.
 */
function joined(o, cx, cy, R, withGear, pods) {
    const k = R / 240, T = Math.round(30 * k), bite = Math.round(20 * k), rimW = Math.max(3, Math.round(5 * k));
    const RC = Math.round(R + T / 2 + bite + 8 * k);       // the arc's circle: clear of its band, and of the pods' bite
    const circles = [{ x: cx, y: cy, r: RC }];
    const list = [];
    const ends = { '-1': { x: cx, r: RC }, '1': { x: cx, r: RC } };
    pods.forEach(([which, readKey, r, side]) => {
        const e = ends[side], x = Math.round(e.x + side * (e.r + r - bite));
        circles.push({ x, y: cy, r });
        list.push(...pod(o, which, x, cy, 2 * (r - bite - Math.round(10 * k)), readKey, true));
        ends[side] = { x, r };
    });
    // (the speed in the arc's open quarter, inside its circle)
    return list.concat(arcTach(o, cx, cy, R, withGear, Math.round(0.86 * R), true), rims(circles, rimW));
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
                arcTach(o, 180, 400, 150, !st, 230),
                st ? pod(o, 'rpm', 1712, 404, 330, null) : pod(o, 'rpm', 1792, 500, 236, null), [
                    C.text('clock', 520, top - 76, 200, 34, C.clock, lit),
                    C.text('outside', 1200, top - 76, 200, 34, (d) => C.outsideText(o, d.outside), lit),
                ],
                C.readingUp('fuel', 560, bot + 2, 260, 30, (d) => C.distText(o, d.frange), 'FUEL RANGE', lit, lbl),
                C.readingUp('elec', 1100, bot + 2, 300, 30, C.focus.both(o), C.focus.rangeLabel(o), C.engineFocus(o) ? lit : elecTxt, lbl),
            );
        }
        if (C.strip(o)) {
            // over the car's own strip (layout_common.STRIP_Y), which shows the gear and the ranges: the arc's circle
            // centred on the screen (its rim's foot above the strip), a pod joined on either side, their centres level
            // (its rim from just under the camera's cowl, NOTCH, to just over the strip)
            return bg.concat(joined(o, 960, 387, 214, false, [['speed', 'clock', 158, -1], ['rpm', 'outside', 158, 1]]));
        }
        if (o.centre === 'stock') {
            // the KOMBI's own centre between: the arc left, the right pod right of it, the ranges right of the box
            return [C.flat('bg', 0, 0, 566, 720, 'bg'), C.flat('bgR', 1104, 0, 816, 720, 'bg')].concat(
                arcTach(o, 250, 400, 200, true, 300), C.mCar(o) ? [] : pod(o, 'rpm', 1256, 392, 280, null), ranges(o));   // (an M car: its second box there)
        }
        // the layout's own strip: the arc left, the pods between it and the KOMBI's gear box (an M car: lower,
        // under the M KOMBI's two boxes), the ranges right of the box
        // (an M car: the pods apart, lower, under the M KOMBI's two boxes)
        if (C.mCar(o)) return bg.concat(arcTach(o, 430, 390, 230, true, 340), pod(o, 'speed', 916, 540, 200, 'clock'), pod(o, 'rpm', 1311, 556, 186, 'outside'), ranges(o));
        return bg.concat(joined(o, 400, 380, 222, true, [['speed', 'clock', 150, 1], ['rpm', 'outside', 138, 1]]), ranges(o));
    },
};
