'use strict';
/**
 * layout_classic.js - "Classic M": the round dials of BMW's M cars of the late 2000s, drawn after a photo of an E92
 * M3's cluster at night (E9X_FS): black faces, a ring of cool white-blue light round each scale (open across the
 * bottom), white bars, dots and numerals, km/h in small numerals inside the mph, thin glowing red needles over dark
 * hubs, the fuel gauge across the speedometer's foot and the oil temperature across the tach's, and the amber
 * display between them. An original drawing, every piece a shader on the cluster's own GPU.
 *
 * Nothing shows the time, the outside temperature or the fuel range (the car's own bottom strip does): the amber
 * display shows the battery's power (boost on a petrol or diesel car, or with Show: Engine), the gear and the speed,
 * and the charge (the coolant).
 */
const C = require('./layout_common');
const B = require('./bimmer');

const PAL = {
    bg: '#000000', face: '#050506', ring: '#b9c4ff', ring2: '#5d63c8', bezel: '#2a2a2f', tick: '#f2f2f2', needle: '#ff3a1c', red: '#ff3a12',
    text: '#f2f2f2', dim: '#9a9aa4', amber: '#ff6a1a', amberDim: '#c0501a', lcd0: '#3c1406', lcd1: '#260b03', lcdEdge: '#120604', regen: '#3ddc84', glow: '#ff6a1a',
};
const pal = () => Object.assign({}, PAL);
const isNum = C.isNum;
const white = (t) => ({ color: [t.text, 1], glow: [t.text, 0] });
const dim = (t) => ({ color: [t.dim, 1], glow: [t.dim, 0] });
const amber = (t) => ({ color: [t.amber, 1], glow: [t.amber, 0.35] });
const amberDim = (t) => ({ color: [t.amberDim, 1], glow: [t.amber, 0.2] });
const dir = (a) => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
const A0 = -134, A1 = 134;     // the sweep (the photo's: 0 at about eight o'clock, the end at about four)
const SUB = [232, 128];        // the small gauges' sweep round their pivot (empty at the left, full at the right)

/** A dial (speed or rpm) at (cx, cy), size across, with its labels. */
function dial(o, which, cx, cy, size) {
    const R = size / 2, k = size / 600, kmh = o.speedUnit === 'kmh', rs = C.rpmScale(o);
    const speed = which === 'speed';
    const sc = speed ? (kmh ? [330, 30, 10, 5] : [200, 20, 10, 5]) : [rs.max, 1, 1, 0.5];
    const red = speed ? sc[0] + 1 : rs.red;
    const out = [{
        key: which, kind: 'e9x', x: cx - R, y: cy - R, w: size, h: size,
        params: {
            u_scale: sc, u_arc: [A0, A1, red, speed ? 0.095 : 0.14],
            // inside the mph: km/h, every 20 to 120, then every 30 (the photo's)
            u_inner: speed && !kmh ? [1.609344, 20, 120, 30] : [0, 0, 0, 0],
            u_sub: [SUB[0], SUB[1], 2, 2],
        },
        colors: (t) => ({ face: t.face, ring: t.ring, ring2: t.ring2, bezel: t.bezel, tick: t.tick, needle: t.needle, red: t.red }),
        value: speed ? (d) => (isNum(d.speed) ? C.speedIn(o, d.speed) : 0) : (d) => (isNum(d.rpm) ? d.rpm / 1000 : 0), max: sc[0], sweep: true,
        dyn: speed ? (d) => ({ u_subv: [isNum(d.fuelPct) ? Math.round(Math.max(0, Math.min(1, d.fuelPct / 100)) * 200) / 200 : 0] })
            : (d) => ({ u_subv: [isNum(d.oil) ? Math.round(Math.max(0, Math.min(1, (d.oil - 50) / 100)) * 200) / 200 : 0] }),
    }];
    // the small gauge's labels round its pivot (0.42 R below the centre): either end and the middle
    const pv = [cx, cy + 0.42 * R], lr = 0.47 * R, h = Math.round(30 * k);
    const at = (a, r) => { const u = dir(a); return [pv[0] + u[0] * r, pv[1] + u[1] * r]; };
    const lab = (key, a, r, txt, w) => { const [x, y] = at(a, r); return C.text(key, Math.round(x - w / 2), Math.round(y - h / 2), w, h, txt, white); };
    const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
    const labels = speed ? ['0', '1/2', '1'] : [tl(50), tl(100), tl(150)];
    out.push(lab(which + 'Sub0', SUB[0] + 4, lr, labels[0], Math.round(70 * k)), lab(which + 'Sub1', 180, lr * 1.04, labels[1], Math.round(70 * k)),
        lab(which + 'Sub2', SUB[1] - 4, lr, labels[2], Math.round(70 * k)));
    if (speed) {
        out.push(B.icon('fuelIcon', Math.round(cx - 14 * k), Math.round(pv[1] + 0.13 * R), Math.round(28 * k), Math.round(28 * k), 'fuel', 'dim'),
            C.text('speedUnit', Math.round(cx - 0.40 * R), Math.round(cy + 0.42 * R), Math.round(70 * k), Math.round(22 * k), kmh ? 'km/h' : 'mph', white, { align: 0 }),
            ...(kmh ? [] : [C.text('speed2Unit', Math.round(cx - 0.30 * R), Math.round(cy + 0.30 * R), Math.round(70 * k), Math.round(20 * k), 'km/h', white, { align: 0 })]));
    } else {
        out.push(B.icon('oilIcon', Math.round(cx - 34 * k), Math.round(pv[1] + 0.12 * R), Math.round(34 * k), Math.round(24 * k), 'oilcan', 'dim'),
            C.text('oilUnit', Math.round(cx + 2 * k), Math.round(pv[1] + 0.12 * R), Math.round(40 * k), Math.round(22 * k), '°' + (o.tempUnit === 'c' ? 'C' : 'F'), white, { align: 0 }),
            C.text('rpmUnit', Math.round(cx - 0.4 * R), Math.round(cy - 0.45 * R), Math.round(0.8 * R), Math.round(22 * k), '1/min x 1000', white));
    }
    return out;
}

/** The amber display between the dials: the battery's power (boost) above; the gear and the speed below, the charge
 * (the coolant) under them. gear: show the gear (not over the car's own strip, which shows it). */
function display(o, X, Y, W, gear) {
    const engine = C.engineFocus(o) || o.vehicle === 'ice';
    const powerC = amber;   // (all amber, as the car's display)
    const box = (key, x, y, w, h) => ({ key, kind: 'panel', x, y, w, h, params: { u_box: [8, 3, 0.1, 1] }, colors: (t) => ({ top: t.lcd0, bottom: t.lcd1, border: t.lcdEdge }) });
    const uw = W - 40, ux = X + 20;
    const out = [
        box('lcdTop', ux, Y, uw, 92),
        C.text('kwNow', ux + 12, Y + 14, uw - 24, 44, C.focus.power(o), powerC),
        C.text('kwNowLbl', ux + 12, Y + 62, uw - 24, 18, C.focus.powerLabel(o, true), amberDim, { tracking: 0.08 }),
        box('lcd', X, Y + 110, W, 170),
    ];
    // the gear (left) and the speed with its unit under it
    const gw = gear ? Math.round(W * 0.32) : 0;
    if (gear) out.push(C.text('gear', X + 12, Y + 132, gw, 56, C.gearText, (t, d) => (C.gearText(d) === 'R' ? { color: [t.red, 1], glow: [t.red, 0.3] } : amber(t)), { align: 0 }));
    out.push(C.text('speedDigits', X + gw + 16, Y + 122, W - gw - 32, 62, (d) => C.speedText(o, d), amber, { align: 1 }),
        C.text('speedDigitsUnit', X + W - 76, Y + 186, 60, 20, C.speedUnit(o), amberDim, { align: 1 }),
        C.flat('lcdRule', X + 14, Y + 212, W - 28, 2, 'amberDim'),
        C.text('socTxt', X + 14, Y + 224, W - 28, 40, engine ? (d) => 'COOLANT ' + C.tempText(o, d.coolant) : (d) => 'CHARGE ' + C.socText(d), amber, { align: 0.5 }));
    return out;
}

module.exports = {
    id: 'classic',
    title: 'Classic M',
    stripFuel: false,   // (its own fuel gauge, in the speedometer)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const strip = C.strip(o);
        if (o.centre === 'map') {
            // the speedometer left of the map, the tach right of it (full screen smaller, right of the KOMBI's box)
            const list = C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(dial(o, 'speed', 208, 360, 404));
            if (strip) return list.concat(dial(o, 'rpm', 1712, 360, 404));
            return list.concat(dial(o, 'rpm', 1792, 500, 256), [C.text('gear', 1520, 130, 230, 92, C.gearText, amber)]);
        }
        if (strip && o.centre !== 'stock') {
            // the car's own bottom strip (the default): the two dials either side of the amber display, above the strip
            return [C.flat('bg', 0, 0, 1920, 720, 'bg')].concat(dial(o, 'speed', 468, 326, 600), dial(o, 'rpm', 1452, 326, 600), display(o, 820, 300, 280, false));
        }
        // full screen: the speedometer left, the tach left of the KOMBI's dark box (with the stock centre: small,
        // between them), the display between; right of the box the electric range and the charge
        const stock = o.centre === 'stock', S = 520, cy = 392;
        const list = [C.flat('bg', 0, 0, stock ? 566 : 1920, 720, 'bg')].concat(dial(o, 'speed', 300, cy, S), stock ? dial(o, 'rpm', 1256, cy, 296) : dial(o, 'rpm', 1120, cy, S));
        if (stock) list.push(C.flat('bgR', 1104, 0, 816, 720, 'bg'));
        const RX = 1672, RW = 216, elec = (t) => (C.engineFocus(o) ? amber(t) : { color: ['#4ab4ff', 1], glow: ['#4ab4ff', 0.3] });
        list.push(...C.reading('elec', RX, 330, RW, 44, C.focus.range(o), C.focus.rangeLabel(o), elec, dim),
            C.text('socRight', RX, 446, RW, 44, C.focus.charge(o), elec));
        if (stock) return list;
        // (an M car's KOMBI leaves a box at x 778-1054 from y 274: the display narrower, left of it)
        return list.concat(C.mCar(o) ? display(o, 584, 230, 186, true) : display(o, 576, 230, 274, true));
    },
};
