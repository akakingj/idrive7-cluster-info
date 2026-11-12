'use strict';
/**
 * layout_twin_cowl.js - "Twin cowl": two big round dials with a ring of ice-blue light inside their scales and red
 * needles, the tach left and the speedometer right, and between them a raised cowl under a chrome arch: two small
 * round gauges in its top (the coolant, C - H, and the fuel, E - F) and a pale grey display under them with dark
 * figures (the speed, the range or a readout, the gear, the time and the outside temperature). The arch runs over the
 * dials' inner edges, as a hood in front of them. An original design (akakingj's build), every piece a shader on the
 * cluster's own GPU; the dials are Classic M's (the e9x shader) in ice blue, without its small gauge.
 *
 * Settings > Small gauge in the tach / in the speedometer pick the cowl's left / right gauge (Auto: the coolant, the
 * fuel). On an M car the dials swap sides (the speedometer left, the tach right, under the M KOMBI's boxes as the
 * other layouts' tachs) and the cowl's gauges sit higher, above its left box.
 *
 * The car's own bottom strip (the default): the two dials either side of the cowl, above the strip; the strip shows
 * the gear, so the display shows a readout (Centre readout: bottom line) where the range would be. Full screen: the
 * dials and the cowl left of the KOMBI's gear box, the ranges right of it. The map: the dials either side of it.
 * The stock centre: the left dial, the right one small right of the KOMBI's centre.
 */
const C = require('./layout_common');
const B = require('./bimmer');
const P = require('./pods');

const PAL = {
    bg: '#000000', face: '#030405', ring: '#8fe6ff', ring2: '#1c74d0', bezel: '#1d2126', tick: '#d6f6ff', needle: '#ff2a1e', red: '#ff3a1a',
    // the cowl's small gauges (pods.js' dial colours)
    face0: '#0b0e11', face1: '#020304', bezel2: '#2a3036', minor: '#5f8fa0', num: '#d6f6ff', glow: '#5fd4ff', hub: '#0b0e11', accent: '#5fd4ff',
    chrome: '#dfe8ee', chrome2: '#56616b',
    text: '#d6f6ff', dim: '#7fb3c4', track: '#0c1418', ev: '#4ab4ff', lcdEdge: '#59656c',
    // the display: pale grey, dark figures
    lcd0: '#c3ccd0', lcd1: '#97a3a9', lcdInk: '#0b0f12', lcdRule: '#5d6a71',
};
const pal = () => Object.assign({}, PAL);
const isNum = C.isNum;
const white = (t) => ({ color: [t.text, 1], glow: [t.glow, 0] });
const ink = (t) => ({ color: [t.lcdInk, 1], glow: [t.lcdInk, 0] });
const inkDim = (t) => ({ color: [t.lcdRule, 1], glow: [t.lcdRule, 0] });
const A0 = -132, A1 = 132;      // the dials' sweep: 0 at about eight o'clock, the end at about four

/** A big dial (speed or rpm) at (cx, cy), size across, and its unit. */
function dial(o, which, cx, cy, size) {
    const R = size / 2, k = size / 600, kmh = o.speedUnit === 'kmh', rs = C.rpmScale(o);
    const speed = which === 'speed';
    const sc = speed ? (kmh ? [260, 20, 10, 5] : [160, 20, 10, 5]) : [rs.max, 1, 1, 0.5];
    const red = speed ? sc[0] + 1 : rs.red;
    // the tach in an electric drive: the battery's power, regeneration below its 0 (as Classic M's)
    const elec = (d) => !speed && C.electric(o, d);
    const kwS = (d) => C.kwDialScale(C.kwRange(d).out);
    return [{
        key: which, kind: 'e9x', x: cx - R, y: cy - R, w: size, h: size,
        params: { u_scale: sc, u_arc: [A0, A1, red, speed ? 0.1 : 0.14], u_sub: [0, 0, 0, 0], u_subv: [0], u_min: [0], u_zero: [0], u_regen: C.REGEN_RGB },
        colors: (t) => ({ face: t.face, ring: t.ring, ring2: t.ring2, bezel: t.bezel, tick: t.tick, needle: t.needle, red: t.red }),
        value: speed ? (d) => (isNum(d.speed) ? C.speedIn(o, d.speed) : 0)
            : (d) => (elec(d) ? (isNum(d.kw) ? Math.max(-C.kwRange(d).in, Math.min(kwS(d).max, d.kw)) : 0) : isNum(d.rpm) ? d.rpm / 1000 : 0),
        max: sc[0], sweep: true,
        range: speed ? undefined : (d) => (elec(d) ? [-C.kwRange(d).in, kwS(d).max] : [0, sc[0]]),
        dyn: speed ? undefined
            : (d) => (elec(d) ? { u_scale: [kwS(d).max, kwS(d).major, kwS(d).major, kwS(d).major / 2], u_arc: [A0, A1, kwS(d).max + 1, 0.14], u_min: [-C.kwRange(d).in], u_zero: [C.KW_ZERO] }
                : { u_scale: sc, u_arc: [A0, A1, Math.min(red, C.shiftPoint(o, d).red / 1000), 0.14], u_min: [0], u_zero: [0] }),
    },
    speed ? C.text('speedUnit', Math.round(cx - 0.4 * R), Math.round(cy + 0.3 * R), Math.round(0.8 * R), Math.round(24 * k), kmh ? 'km/h' : 'mph', white, { tracking: 0.1 })
        : C.text('rpmUnit', Math.round(cx - 0.4 * R), Math.round(cy + 0.3 * R), Math.round(0.8 * R), Math.round(24 * k), (d) => (elec(d) ? 'kW' : 'x1000 rpm'), white, { tracking: 0.1 })];
}

/**
 * One of the cowl's small gauges, size S at (cx, cy): `which` 'rpm' (the left: Settings > Small gauge in the tach,
 * Auto the coolant) or 'speed' (the right: in the speedometer, Auto the fuel). A temperature as C - H (Settings >
 * Temperature gauges), the fuel E - F, any other its name and figures under the pivot.
 */
function small(o, which, cx, cy, S) {
    const k = S / 160, g = C.gaugeOf(o, which);
    const key = g ? g.key : which === 'rpm' ? 'coolant' : 'fuel';
    const ch = C.chOf(o, key);
    const fuel = !g && key === 'fuel';
    const hot = key === 'coolant' && !g ? C.hotAt(o, 'coolant') : null;
    const redAt = ch ? C.chRed(o, ch) * 100 : g ? Math.min(101, g.redFrac * 100) : fuel ? 101 : (hot - 40);
    const value = ch ? (d) => C.chFrac(ch, d[ch]) * 100 : g ? (d) => g.frac(d) * 100
        : fuel ? (d) => (isNum(d.fuelPct) ? Math.max(0, Math.min(100, d.fuelPct)) : 0) : (d) => (isNum(d.coolant) ? Math.max(0, d.coolant - 40) : 0);
    const id = 'cowl' + (which === 'rpm' ? 'L' : 'R');
    const list = [{
        key: id, kind: 'dial', x: cx - S / 2, y: cy - S / 2, w: S, h: S,
        params: { u_scale: [100, 50, 12.5, redAt], u_arc: [-118, 118, 0, 0], u_needle_dim: [58 * k, 10 * k, 5 * k, 2], u_look: [0.9, 0.85, 0, 0], u_look2: [Math.max(3, Math.round(5 * k)), S / 640, 0.75, 0.8] },
        colors: P.dialColours, value, max: 100, sweep: true,
    }];
    const lh = Math.max(12, Math.round(18 * k));
    if (ch) list.push(...C.chMarks(id + 'Ch', cx, cy, S * 0.3, -112, 112, lh, white));
    else if (fuel) {
        const at = (a) => [cx + Math.sin(a * Math.PI / 180) * S * 0.3, cy - Math.cos(a * Math.PI / 180) * S * 0.3];
        const [ex, ey] = at(-112), [fx, fy] = at(112), w = Math.round(lh * 1.6);
        list.push(C.text(id + 'E', Math.round(ex - w / 2), Math.round(ey - lh / 2), w, lh, 'E', (t) => ({ color: [t.red, 1], glow: [t.red, 0.3] })),
            C.text(id + 'F', Math.round(fx - w / 2), Math.round(fy - lh / 2), w, lh, 'F', white));
    }
    if (g) {
        list.push(C.text(id + 'Lbl', cx - Math.round(60 * k), cy + Math.round(18 * k), Math.round(120 * k), Math.round(14 * k), g.label, white, { tracking: 0.12 }));
        if (!ch) list.push(C.text(id + 'Num', cx - Math.round(60 * k), cy + Math.round(36 * k), Math.round(120 * k), Math.round(20 * k), g.txt, (t, d) => (g.hot(d) ? { color: [t.red, 1], glow: [t.red, 0.3] } : white(t))));
    } else {
        // its icon over the pivot: the thermometer, the pump
        const iw = Math.round(30 * k);
        list.push(B.icon(id + 'Icon', cx - Math.round(iw / 2), cy + Math.round(16 * k), iw, iw, key === 'coolant' ? 'therm' : 'fuel', 'dim'));
    }
    return list;
}

/** The chrome arch over the cowl: round (cx, cy), radius r, from -a to a degrees (two bands, a bright edge in front). */
function arch(cx, cy, r, a, k) {
    const out = [];
    [[r, Math.max(4, Math.round(9 * k)), 'chrome', 'chrome2'], [r - Math.round(10 * k), Math.max(2, Math.round(3 * k)), 'chrome2', 'chrome2']].forEach(([rr, w, c0, c1], i) => {
        const xs = [], ys = [];
        for (let t = -a; t <= a + 0.01; t += a / 24) {
            for (const q of [rr - w, rr + w]) { xs.push(cx + q * Math.sin(t * Math.PI / 180)); ys.push(cy - q * Math.cos(t * Math.PI / 180)); }
        }
        const X = Math.floor(Math.min(...xs) - 6), Y = Math.floor(Math.min(...ys) - 6);
        const W = Math.ceil(Math.max(...xs) + 6) - X, H = Math.ceil(Math.max(...ys) + 6) - Y;
        out.push({
            key: 'arch' + i, kind: 'band', x: X, y: Y, w: W, h: H,
            params: { u_geo: [cx - X, cy - Y, rr, w], u_span: [-a, a, 0, 0], u_marks: [0, 0, 0, 0], u_red: [2], u_zero: [0], u_soft: [1] },
            colors: (t) => ({ track: t[c1], fill0: t[c1], fill1: t[c0], redc: t[c0], tip: t[c1], tick: t[c0], num: t[c0] }),
            value: () => 1, max: 1,
        });
    });
    return out;
}

/**
 * The cowl's display, X Y W H: the speed large (the gear left of it, not over the car's own strip, which shows it),
 * under it the range (over the strip, which shows the range: Centre readout: bottom line), along the bottom the time
 * and the outside temperature (over the strip: Readout 1 and 2, layouts.js).
 */
function display(o, X, Y, W, H, strip) {
    const k = H / 224, at = (y) => Y + Math.round(y * k), hh = (h) => Math.round(h * k);
    const out = [
        { key: 'lcd', kind: 'panel', x: X, y: Y, w: W, h: H, params: { u_box: [10, 2, 0.1, 1] }, colors: (t) => ({ top: t.lcd0, bottom: t.lcd1, border: t.lcdEdge }) },
        C.text('gear', X + 10, at(14), Math.round(W * 0.3), hh(44), C.gearText, (t, d) => (C.gearText(d) === 'R' ? { color: [t.red, 1], glow: [t.red, 0] } : ink(t)), { align: 0 }),
        C.text('speedDigits', X + Math.round(W * 0.3), at(8), Math.round(W * 0.7) - 12, hh(62), (d) => C.speedText(o, d), ink, { align: 1 }),
        C.text('speedDigitsUnit', X + Math.round(W * 0.3), at(72), Math.round(W * 0.7) - 12, hh(16), C.speedUnit(o), inkDim, { align: 1, tracking: 0.1 }),
        Object.assign(C.flat('lcdRule0', X + 8, at(96), W - 16, 2, 'lcdRule'), { z: 1 }),
        Object.assign(C.flat('lcdRule1', X + 8, at(156), W - 16, 2, 'lcdRule'), { z: 1 }),
        C.text('clock', X + 10, at(170), Math.round((W - 30) / 2), hh(36), C.clock, ink, { align: 0 }),
        C.text('outside', X + Math.round(W / 2) + 4, at(170), Math.round((W - 30) / 2), hh(36), (d) => C.outsideText(o, d.outside), ink, { align: 1 }),
    ];
    if (strip) out.push(C.fitText(C.text('lcdLow', X + 10, at(108), W - 20, hh(36), C.readout(o, o.infoLow || 'coolant', { w: W - 20, h: hh(36) }, true) || '', ink)));
    else {
        out.push(B.icon('lcdFuelIcon', X + 12, at(112), hh(28), hh(28), 'fuel', 'lcdInk'),
            C.text('lcdRange', X + 20 + hh(28), at(108), W - 32 - hh(28), hh(36), (d) => C.distText(o, d.frange), ink, { align: 1 }));
    }
    return out;
}

module.exports = {
    id: 'twin_cowl',
    title: 'Twin cowl',
    stripFuel: false,   // (its own fuel gauge, in the cowl)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const strip = C.strip(o), m = C.mCar(o);
        // the left and the right dial: the tach left, the speedometer right (an M car: swapped, the tach under its boxes)
        const L = m ? 'speed' : 'rpm', R = m ? 'rpm' : 'speed';
        if (o.centre === 'map') {
            // the dials either side of the map (full screen: the right one small, right of the KOMBI's box)
            const list = C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(dial(o, 'speed', 208, 360, 404));
            if (strip) return list.concat(dial(o, 'rpm', 1712, 360, 404));
            return list.concat(dial(o, 'rpm', 1792, 500, 256), [C.text('gear', 1520, 130, 230, 92, C.gearText, white)]);
        }
        if (strip && o.centre !== 'stock') {
            // the car's own bottom strip (the default): the dials either side of the cowl, above the strip; the arch
            // over their inner edges
            return [C.flat('bg', 0, 0, 1920, 720, 'bg')].concat(dial(o, L, 470, 336, 560), dial(o, R, 1450, 336, 560),
                arch(960, 500, 316, 48, 1), small(o, 'rpm', 868, 300, 164), small(o, 'speed', 1052, 300, 164), display(o, 864, 394, 192, 222, true));
        }
        // full screen: the dials left of the KOMBI's gear box (with the stock centre: the right one small, between),
        // the cowl between them; right of the box the ranges
        const stock = o.centre === 'stock', S = stock ? 520 : 470, cy = 392;
        const list = [C.flat('bg', 0, 0, stock ? 566 : 1920, 720, 'bg')].concat(stock ? dial(o, 'speed', 300, cy, S) : dial(o, L, 270, cy, S), stock ? dial(o, 'rpm', 1256, cy, 296) : dial(o, R, 1150, cy, S));
        if (stock) {
            list.push(C.flat('bgR', 1104, 0, 816, 720, 'bg'));
            return list;
        }
        // (an M car: the small gauges higher, above the left M box, and smaller)
        const sy = m ? 196 : 345, ss = m ? 112 : 140;
        // (an M car: no arch - its left box sits where the arch's right half runs)
        return list.concat(m ? [] : arch(710, 520, 270, 58, 0.9), small(o, 'rpm', 636, sy, ss), small(o, 'speed', 784, sy, ss),
            display(o, 622, 425, m ? 148 : 176, 195, false), P.ranges(o));
    },
};
