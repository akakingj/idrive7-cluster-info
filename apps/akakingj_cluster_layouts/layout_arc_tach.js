'use strict';
/**
 * layout_arc_tach.js - "Arc tach": three round dials under chrome rings, the big tach in the middle in front, a
 * smaller dial either side tucked behind it (each side ring ends where it goes behind the middle one's). The tach:
 * a needle round numerals inside a dark ring, the red zone along the ring (from where the shift point puts it, lower
 * while the oil is cold), the main readout above the hub, the digital speed and its unit at the bottom right where
 * the scale leaves off, the gear at the bottom left (Settings > Arc tach: the gear in the arc; not over the car's own
 * strip, which shows it). Each side dial: one gauge along its outer top (left: Small gauge in the speedometer, Auto
 * the coolant, C - H; right: Small gauge in the tach, Auto the fuel, F at the top and E below), and a readout at its
 * foot (the time and the outside temperature; over the car's strip Readout 1 and 2). An original design after the
 * idea of a three-ring sports-car cluster (akakingj's build).
 *
 * The car's own bottom strip (the default): the three centred, the tach's ring from just under the camera's cowl to
 * just over the strip. The layout's own strip: the three left of the KOMBI's gear box, the ranges right of it (an M
 * car: the tach left and the side dials apart, under its boxes). The map: the tach left of it, a dial right. The
 * stock centre: the tach left, a dial right of the KOMBI's centre.
 */
const C = require('./layout_common');
const B = require('./bimmer');
const TP = require('./pods');
const { PALETTES: POD_PALETTES, dialColours, lit, lbl, gearC, elecTxt, ranges } = TP;

/* the pods' colours (pods.js), and the tach's: its face and its dark ring */
const TACH = {
    comfort: { tface0: '#0d0e10', tface1: '#030304', ring: '#2a2d32' },
    sport: { tface0: '#120a09', tface1: '#040202', ring: '#3a2522' },
    efficient: { tface0: '#0a0e11', tface1: '#020405', ring: '#22303a' },
};
// (no Object.fromEntries: the head unit's Node is 8)
const PALETTES = Object.keys(POD_PALETTES).reduce((o, k) => { o[k] = Object.assign({ regen: '#3ddc84' }, POD_PALETTES[k], TACH[k]); return o; }, {});

/* the tach's sweep: three quarters of a turn from just left of six o'clock, up the left, over the top, down to
 * a little past three; the quarter it leaves open (bottom right) holds the digital speed */
const A0 = -165, A1 = 105;
const kwOf = (d) => (C.isNum(d.kw) ? d.kw : 0);

/**
 * The tach at (cx, cy), radius R (to the inside of its chrome ring): numerals 0 to the rev scale's end, the needle,
 * the red zone; the main readout above the hub, the speed bottom right, the gear (withGear) bottom left. On a
 * plug-in hybrid in an electric mode it reads the battery's power (layout_common.tachValue, tachDyn).
 */
function tach(o, cx, cy, R, withGear) {
    const k = R / 240, s = C.rpmScale(o), S = 2 * R;
    const evOff = (d) => C.electric(o, d);
    const list = [
        {
            key: 'rpm', kind: 'dial', x: cx - R, y: cy - R, w: S, h: S,
            params: {
                u_scale: [s.max, s.major, s.minor, s.red], u_arc: [A0, A1, Math.round(36 * k), Math.round(160 * k)],
                u_needle_dim: [Math.round(196 * k), Math.round(36 * k), Math.round(13 * k), 4], u_look: [0.9, 0.85, 0, 0], u_look2: [0, S / 640, 0.85, 0.7],
            },
            colors: (t) => Object.assign(dialColours(t), { face0: t.tface0, face1: t.tface1, bezel: t.ring, bezel2: t.ring }),
            max: s.max, sweep: true, value: C.tachValue(o), range: C.tachRange(o, s), dyn: C.tachDyn(o, s, s.red),
        },
        // the speed bottom right, where the scale leaves off; its unit and the scale's under it
        C.text('speedDigits', cx + Math.round(0.02 * R), cy + Math.round(0.25 * R), Math.round(0.5 * R), Math.round(0.27 * R), (d) => C.speedText(o, d), lit, { align: 1 }),
        C.text('speedDigitsUnit', cx + Math.round(0.02 * R), cy + Math.round(0.54 * R), Math.round(0.5 * R), Math.round(0.07 * R), C.speedUnit(o), lbl, { align: 1, tracking: 0.12 }),
        C.text('rpmUnit', cx + Math.round(0.12 * R), cy + Math.round(0.65 * R), Math.round(0.4 * R), Math.round(0.055 * R), (d) => (evOff(d) ? 'kW' : 'x1000 rpm'), (t, d) => (evOff(d) ? elecTxt(t) : lbl(t)), { align: 1, tracking: 0.1 }),
        // the main readout above the hub
        C.text('kwNow', cx - Math.round(0.36 * R), cy - Math.round(0.46 * R), Math.round(0.72 * R), Math.round(0.15 * R), C.focus.power(o), (t, d) => (C.engineFocus(o) ? lit(t) : kwOf(d) < -0.3 ? { color: [t.regen, 1], glow: [t.regen, 0.3] } : elecTxt(t))),
        C.text('kwNowLbl', cx - Math.round(0.3 * R), cy - Math.round(0.29 * R), Math.round(0.6 * R), Math.round(0.055 * R), C.focus.powerLabel(o, true), lbl, { tracking: 0.1 }),
    ];
    // (the gear: Settings > Arc tach: the gear in the arc; not twice, with the gear as the main readout too)
    if (withGear && o.arcGear !== 'off' && o.infoMain !== 'gear') list.push(C.text('gear', cx - Math.round(0.42 * R), cy + Math.round(0.14 * R), Math.round(0.3 * R), Math.round(0.22 * R), C.gearText, gearC));
    return list;
}

/**
 * A side dial at (cx, cy), radius r (to the inside of its ring), on `side` (-1 left, +1 right) of the tach: its
 * gauge along the top away from the tach (`which` 'speed': Small gauge in the speedometer, Auto the coolant; 'rpm':
 * Small gauge in the tach, Auto the fuel), a temperature C - H, the fuel F at the top and E below (its red at E),
 * another reading its name and figures; its icon by the pivot; the readout `readKey` at its foot.
 */
function sideDial(o, which, cx, cy, r, side, readKey) {
    const k = r / 170, S = 2 * r, g = C.gaugeOf(o, which);
    const key = g ? g.key : which === 'speed' ? 'coolant' : 'fuel', ch = C.chOf(o, key);
    const fuel = !g && key === 'fuel';
    // the scale's ends: from low (C, E... at the bottom outside) up over the top; the right one mirrored
    const arc = side < 0 ? [-125, 5] : [-5, 125];
    // (the fuel on the right: F at the top, E at the bottom - the scale runs backwards, its red at E)
    const back = fuel && side > 0;
    const red = ch ? C.chRed(o, ch) * 100 : g ? Math.min(101, g.redFrac * 100) : fuel ? (back ? 88 : 101) : C.hotAt(o, 'coolant') - 40;
    const raw = ch ? (d) => C.chFrac(ch, d[ch]) * 100 : g ? (d) => g.frac(d) * 100
        : fuel ? (d) => (C.isNum(d.fuelPct) ? Math.max(0, Math.min(100, d.fuelPct)) : 0) : (d) => (C.isNum(d.coolant) ? Math.max(0, d.coolant - 40) : 0);
    const id = 'side' + (side < 0 ? 'L' : 'R');
    const list = [{
        key: id, kind: 'dial', x: cx - r, y: cy - r, w: S, h: S,
        params: { u_scale: [100, 50, 12.5, red], u_arc: [arc[0], arc[1], 0, 0], u_needle_dim: [Math.round(112 * k), Math.round(20 * k), Math.round(8 * k), 3], u_look: [0.85, 0.85, 0, 0], u_look2: [0, S / 640, 0.75, 0.6] },
        colors: (t) => Object.assign(dialColours(t), { face0: t.tface0, face1: t.tface1, bezel: t.ring, bezel2: t.ring }),
        value: back ? (d) => 100 - raw(d) : raw, max: 100, sweep: true,
    }];
    // the scale's end letters, a little inside its marks
    const lh = Math.max(14, Math.round(24 * k)), at = (a) => [cx + Math.sin(a * Math.PI / 180) * r * 0.62, cy - Math.cos(a * Math.PI / 180) * r * 0.62];
    const letter = (n, a, txt, hot) => { const [x, y] = at(a), w = Math.round(lh * 1.6); return C.text(id + n, Math.round(x - w / 2), Math.round(y - lh / 2), w, lh, txt, hot ? (t) => ({ color: [t.red, 1], glow: [t.red, 0.3] }) : lit); };
    const lo = side < 0 ? arc[0] : arc[1], hi = side < 0 ? arc[1] : arc[0];   // (the reading's low end, its high end)
    if (ch) list.push(letter('Lo', lo, 'C'), letter('Hi', hi, 'H', true));
    else if (fuel) list.push(letter('Lo', back ? arc[1] : lo, 'E', true), letter('Hi', back ? arc[0] : hi, 'F'));
    // its icon (or the picked reading's name and figures) by the pivot, on the side away from the scale
    const ix = cx - side * Math.round(0.02 * r);
    if (g) {
        list.push(C.text(id + 'Lbl', ix - Math.round(0.45 * r), cy + Math.round(0.14 * r), Math.round(0.9 * r), Math.round(0.1 * r), g.label, lbl, { tracking: 0.12 }));
        if (!ch) list.push(C.text(id + 'Num', ix - Math.round(0.45 * r), cy + Math.round(0.27 * r), Math.round(0.9 * r), Math.round(0.15 * r), g.txt, (t, d) => (g.hot(d) ? { color: [t.red, 1], glow: [t.red, 0.3] } : lit(t))));
    } else {
        const iw = Math.round(0.2 * r);
        list.push(B.icon(id + 'Icon', ix - Math.round(iw / 2), cy + Math.round(0.14 * r), iw, iw, key === 'coolant' ? 'therm' : 'fuel', 'dim'));
    }
    if (readKey) {
        const txt = readKey === 'clock' ? C.clock : (d) => C.outsideText(o, d.outside);
        list.push(C.text(readKey, cx - Math.round(0.5 * r), cy + Math.round(0.5 * r), Math.round(r), Math.round(0.16 * r), txt, lit));
    }
    return list;
}

/**
 * Chrome rings round circles [{ x, y, r, front }] (r: the ring's middle line), w px thick: the one marked front all
 * round; each other one all round but where it goes behind a front one (inside its ring), so it seems to pass under
 * it. Each ring a thin satin band, in arcs (the band's angles wrap at six o'clock).
 */
function rims(circles, w) {
    const out = [];
    const wrap = (a) => ((a + 540) % 360) - 180;
    circles.forEach((c, i) => {
        const gaps = [];
        if (!c.front) {
            circles.forEach((e) => {
                if (!e.front || e === c) return;
                const D = Math.hypot(e.x - c.x, e.y - c.y), er = e.r + w;
                if (!(D < c.r + er && D > Math.abs(c.r - er))) return;
                const half = Math.acos((D * D + c.r * c.r - er * er) / (2 * D * c.r)) * 180 / Math.PI;
                gaps.push({ at: Math.atan2(e.x - c.x, -(e.y - c.y)) * 180 / Math.PI, half });
            });
        }
        const open = (a) => gaps.every((g) => Math.abs(wrap(a - g.at)) > g.half);
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
 * The three: the tach at (cx, cy), radius R inside its ring, in front; the side dials [which, readKey, radius]
 * left and right, their rings `tuck` px behind the tach's, their centres level with it. The sides first, the tach
 * over them, the rings last.
 */
function three(o, cx, cy, R, withGear, sides, tuck) {
    const k = R / 240, w = Math.max(4, Math.round(6 * k)), RC = R + w;
    const circles = [{ x: cx, y: cy, r: RC, front: true }];
    let list = [];
    sides.forEach(([which, readKey, r], i) => {
        const side = i === 0 ? -1 : 1, x = Math.round(cx + side * (RC + r + w - tuck));
        circles.push({ x, y: cy, r: r + w });
        list = list.concat(sideDial(o, which, x, cy, r, side, readKey));
    });
    return list.concat(tach(o, cx, cy, R, withGear), rims(circles, w));
}

/** A dial alone, with its own ring (the map, the stock centre, an M car's own strip). */
function alone(o, which, cx, cy, r, side, readKey) {
    const w = Math.max(3, Math.round(5 * r / 170));
    return sideDial(o, which, cx, cy, r, side, readKey).concat(rims([{ x: cx, y: cy, r: r + w, front: true }], w).map((p) => Object.assign(p, { key: 'rimS' + which + p.key })));
}
function tachAlone(o, cx, cy, R, withGear) {
    const w = Math.max(4, Math.round(6 * R / 240));
    return tach(o, cx, cy, R, withGear).concat(rims([{ x: cx, y: cy, r: R + w, front: true }], w));
}

module.exports = {
    id: 'arc_tach',
    title: 'Arc tach',
    palette: (lookId) => PALETTES[lookId] || PALETTES.comfort,
    gearText: C.gearText,
    stripFuel: false,   // (its own fuel gauge, the right dial)
    speedGauge: false,  // (the speed in figures only)

    pieces(o) {
        const bg = [C.flat('bg', 0, 0, 1920, 720, 'bg')];
        if (o.centre === 'map') {
            // the tach left of the map, a dial right of it (above the KOMBI's gear box without the car's strip); the
            // readouts above the map, the ranges under it
            const top = C.MAP.y, bot = C.MAP.y + C.MAP.h, st = C.strip(o);
            return C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(
                tachAlone(o, 196, 390, 176, !st),
                st ? alone(o, 'rpm', 1712, 390, 168, 1, null) : alone(o, 'rpm', 1792, 520, 110, 1, null), [
                    C.text('clock', 520, top - 76, 200, 34, C.clock, lit),
                    C.text('outside', 1200, top - 76, 200, 34, (d) => C.outsideText(o, d.outside), lit),
                ],
                C.readingUp('fuel', 560, bot + 2, 260, 30, (d) => C.distText(o, d.frange), 'FUEL RANGE', lit, lbl),
                C.readingUp('elec', 1100, bot + 2, 300, 30, C.focus.both(o), C.focus.rangeLabel(o), C.engineFocus(o) ? lit : elecTxt, lbl),
            );
        }
        if (C.strip(o)) {
            // over the car's own strip (layout_common.STRIP_Y), which shows the gear and the ranges: the tach centred,
            // its ring from just under the camera's cowl (NOTCH) to just over the strip, a dial behind it either side
            return bg.concat(three(o, 960, 387, 246, false, [['speed', 'clock', 176], ['rpm', 'outside', 176]], 72));
        }
        if (o.centre === 'stock') {
            // the KOMBI's own centre between: the tach left, a dial right of it, the ranges right of the box
            return [C.flat('bg', 0, 0, 566, 720, 'bg'), C.flat('bgR', 1104, 0, 816, 720, 'bg')].concat(
                tachAlone(o, 270, 392, 230, true), C.mCar(o) ? [] : alone(o, 'rpm', 1256, 392, 136, 1, null), ranges(o));   // (an M car: its second box there)
        }
        // the layout's own strip: the three left of the KOMBI's gear box, the ranges right of it (an M car: the tach
        // left, the dials apart and lower, under the M KOMBI's two boxes)
        if (C.mCar(o)) return bg.concat(tachAlone(o, 400, 390, 236, true), alone(o, 'speed', 916, 542, 96, -1, 'clock'), alone(o, 'rpm', 1311, 552, 88, 1, 'outside'), ranges(o));
        return bg.concat(three(o, 720, 384, 240, true, [['speed', 'clock', 160], ['rpm', 'outside', 160]], 66), ranges(o));
    },
};
