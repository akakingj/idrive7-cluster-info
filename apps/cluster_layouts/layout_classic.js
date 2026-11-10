'use strict';
/**
 * layout_classic.js - "Classic M": two round dials in the manner of BMW's M cars of the late 2000s at night: black
 * faces, white numerals and ticks, a ring of cool white-blue light round each, red needles; a second scale inside
 * the speedometer (km/h with mph, mph with km/h), the fuel in a small dial at its foot and the oil temperature in a
 * small dial at the tach's foot, and a narrow amber display between them. An original drawing (every piece a
 * shader on the cluster's own GPU), made for a plug-in hybrid: in an electric drive the tach reads the battery's
 * power and the display shows it.
 *
 * Nothing shows the time, the outside temperature or the fuel range: the car's own bottom strip shows them (with
 * it, the layout ends above it; layouts.js).
 */
const C = require('./layout_common');

const BASE = {
    bg: '#000000', face0: '#0b0c0e', face1: '#020203', bezel: '#e6f0ff', bezel2: '#5f7fae', tick: '#ffffff', minor: '#cfd6e0',
    num: '#ffffff', red: '#ff2a1a', needle: '#ff3418', hub: '#0d0d0f', rim: '#bcd8ff', rimGlow: '#7fb2ff',
    lcdTop: '#120804', lcdBottom: '#070302', lcdEdge: '#3a2416', amber: '#ff7a1c', amberDim: '#b0582a', dim: '#9aa4b2',
    track: '#16181c', ev: '#4ab4ff', regen: '#3ddc84', text: '#ffffff',
};
const PALETTES = {
    comfort: { accent: '#ff3418', glow: '#7fb2ff' },
    sport: { accent: '#ff2a1a', glow: '#ff6a3a', rim: '#ffd2c4', rimGlow: '#ff5a3a' },
    efficient: { accent: '#3ddc84', glow: '#4ab4ff', rim: '#bfe6ff', rimGlow: '#4ab4ff' },
};
const pal = (lookId) => Object.assign({}, BASE, PALETTES[lookId] || PALETTES.comfort);

const dialColours = (t) => ({ face0: t.face0, face1: t.face1, bezel: t.bezel, bezel2: t.bezel2, tick: t.tick, minor: t.minor, num: t.num, red: t.red, needle: t.needle, hub: t.hub, accent: t.accent, glow: t.rimGlow });
const white = (t) => ({ color: [t.text, 1], glow: [t.rimGlow, 0.15] });
const lbl = (t) => ({ color: [t.dim, 1], glow: [t.rimGlow, 0] });
const amber = (t) => ({ color: [t.amber, 1], glow: [t.amber, 0.45] });
const amberLbl = (t) => ({ color: [t.amberDim, 1], glow: [t.amber, 0.2] });
const isNum = C.isNum;

/* the speedometer's scales: mph to 180 with km/h inside, or km/h to 330 with mph inside */
const MPH_KMH = 1.609344;
const speedo = (o) => (o.speedUnit === 'kmh' ? { max: 330, major: 30, minor: 10, inner: 200, step: 20, per: 1 / MPH_KMH }
    : { max: 180, major: 20, minor: 10, inner: 280, step: 20, per: MPH_KMH });

/** The ring of light round a dial: a thin band all the way round, lit (its glow is the light). */
const rim = (key, cx, cy, size) => {
    const R = size / 2 - Math.round(size * 0.035), h = size / 2;
    return { key, kind: 'band', x: cx - h, y: cy - h, w: size, h: size, z: 4,
        params: { u_geo: [h, h, R, Math.max(3, Math.round(size * 0.008))], u_span: [-180, 180, 0, 0], u_marks: [0, 0, 0, 0], u_red: [2], u_soft: [0] },
        colors: (t) => ({ track: t.rim, fill0: t.rim, fill1: t.rim, redc: t.rim, tip: t.rim, tick: t.rim, num: t.rim }),
        value: () => 1, max: 1 };
};

/** A big dial, its ring, and the small dial at its foot (the fuel, or the oil temperature), sized `size`, centred at (cx, cy). */
function dialSet(o, which, cx, cy, size) {
    const k = size / 640, sp = speedo(o), s = which === 'speed' ? sp : C.rpmScale(o);
    const red = which === 'speed' ? sp.max + 1 : s.red;
    const sub = Math.round(170 * k), subDy = Math.round(176 * k), ks = sub / 640;
    const out = [
        {
            key: which, kind: 'dial', x: cx - size / 2, y: cy - size / 2, w: size, h: size,
            params: { u_scale: [s.max, s.major, s.minor, red], u_arc: [-135, 135, Math.round((which === 'speed' ? 34 : 50) * k), (which === 'speed' ? 240 : 226) * k],
                u_needle_dim: [270 * k, 46 * k, 13 * k, 4], u_look: [0.55, 0.15, 0, 0], u_look2: [Math.round(12 * k), k, 0.7, 0.6] },
            colors: dialColours, max: s.max, sweep: true,
            value: which === 'speed' ? (d) => (isNum(d.speed) ? C.speedIn(o, d.speed) : 0) : C.tachValue(o),
            dyn: which === 'speed' ? undefined : C.tachDyn(o, s, red),
        },
        rim(which + 'Rim', cx, cy, size),
        {
            key: which === 'speed' ? 'fuelDial' : 'oilDial', kind: 'dial', x: cx - sub / 2, y: cy + subDy - sub / 2, w: sub, h: sub, z: 5,
            params: which === 'speed'
                ? { u_scale: [1, 0.5, 0.125, 2], u_arc: [-110, 110, 0, 0], u_needle_dim: [60 * sub / 170, 12 * sub / 170, 6, 2.5], u_look: [0.4, 0.1, 0, 0], u_look2: [Math.max(3, Math.round(4 * sub / 170)), ks, 0.5, 0.4] }
                : { u_scale: [100, 50, 12.5, 80], u_arc: [-110, 110, 0, 0], u_needle_dim: [60 * sub / 170, 12 * sub / 170, 6, 2.5], u_look: [0.4, 0.1, 0, 0], u_look2: [Math.max(3, Math.round(4 * sub / 170)), ks, 0.5, 0.4] },
            colors: dialColours, max: which === 'speed' ? 1 : 100, sweep: true,
            value: which === 'speed' ? (d) => (isNum(d.fuelPct) ? d.fuelPct / 100 : 0) : (d) => (isNum(d.oil) ? Math.max(0, d.oil - 50) : 0),
        },
        // the scale's unit, under the centre
        C.text(which + 'Unit', cx - 110, cy - Math.round(118 * k), 220, Math.round(22 * k), which === 'speed' ? C.speedUnit(o)
            : (d) => (C.electric(o, d) ? 'kW' : '1/min x 1000'), which === 'speed' ? white : (t, d) => (C.electric(o, d) ? { color: [t.ev, 1], glow: [t.ev, 0.3] } : white(t)), { tracking: 0.04 }),
    ];
    // the small dial's labels: either end and the middle (below it)
    const lab = (key, x, y, w, txt) => C.text(key, Math.round(x - w / 2), Math.round(y), w, Math.round(24 * k), txt, white);
    const sx = cx, sy = cy + subDy, r = sub * 0.62;
    const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
    const labels = which === 'speed' ? ['0', '1/2', '1'] : [tl(50), tl(100), tl(150)];
    out.push(lab(which + 'SubL', sx - r * 0.92, sy + r * 0.2, 60, labels[0]), lab(which + 'SubM', sx, sy + sub / 2 + 2, 60, labels[1]), lab(which + 'SubR', sx + r * 0.92, sy + r * 0.2, 60, labels[2]));
    if (which === 'speed') {
        // the second scale, inside the first: numerals every 20 on a thin ring, over the same sweep
        const R = Math.round(160 * k), h = size / 2;
        const end = -135 + 270 * (sp.inner / sp.per) / sp.max;
        out.push({ key: 'speed2', kind: 'band', x: cx - h, y: cy - h, w: size, h: size, z: 3,
            params: { u_geo: [h, h, R, 1.5], u_span: [-135, end, 0, 0], u_marks: [sp.inner / sp.step, sp.step, Math.round(19 * k), -Math.round(22 * k)], u_red: [2], u_soft: [1] },
            colors: (t) => ({ track: t.minor, fill0: t.minor, fill1: t.minor, redc: t.minor, tip: t.minor, tick: t.minor, num: t.minor }),
            value: () => 0, max: 1 });
        out.push(C.text('speed2Unit', cx - 80, cy - Math.round(88 * k), 160, Math.round(18 * k), o.speedUnit === 'kmh' ? 'mph' : 'km/h', lbl));
    } else {
        out.push(C.text('oilUnit', cx - 40, sy - Math.round(30 * k), 80, Math.round(18 * k), 'OIL °' + (o.tempUnit === 'c' ? 'C' : 'F'), lbl, { tracking: 0.06 }));
    }
    return out;
}

/** The narrow amber display between the dials: the gear, the speed in figures, the battery's power (boost). */
function display(o, X, Y, W, H, gear) {
    const powerC = (t, d) => (C.engineFocus(o) ? amber(t) : isNum(d.kw) && d.kw < -0.3 ? { color: [t.regen, 1], glow: [t.regen, 0.3] } : amber(t));
    const out = [{ key: 'lcd', kind: 'panel', x: X, y: Y, w: W, h: H, params: { u_box: [10, 2, 0.15, 1] }, colors: (t) => ({ top: t.lcdTop, bottom: t.lcdBottom, border: t.lcdEdge }) }];
    let y = Y + 18;
    if (gear) { out.push(C.text('gear', X, y, W, 96, C.gearText, (t, d) => (C.gearText(d) === 'R' ? { color: [t.red, 1], glow: [t.red, 0.4] } : amber(t)))); y += 112; }
    out.push(C.text('speedDigits', X + 10, y, W - 20, gear ? 60 : 96, (d) => C.speedText(o, d), amber));
    y += gear ? 64 : 102;
    out.push(C.text('speedDigitsUnit', X, y, W, 20, C.speedUnit(o), amberLbl, { tracking: 0.1 }));
    y += 40;
    out.push(C.flat('lcdRule', X + 16, y, W - 32, 2, 'lcdEdge'));
    y += 16;
    out.push(C.text('kwNow', X + 10, y, W - 20, 44, C.focus.power(o), powerC), C.text('kwNowLbl', X, y + 50, W, 18, C.focus.powerLabel(o), amberLbl, { tracking: 0.1 }));
    return out;
}

module.exports = {
    id: 'classic',
    title: 'Classic M',
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        if (o.centre === 'map') {
            // the speedometer left of the map; a smaller tach right of it (and of the dark box), the gear above
            const list = C.aroundMap().map((r, i) => C.flat('bg' + i, r.x, r.y, r.w, r.h, 'bg')).concat(dialSet(o, 'speed', 208, 360, 404));
            if (C.strip(o)) return list.concat(dialSet(o, 'rpm', 1712, 360, 404));
            return list.concat(dialSet(o, 'rpm', 1792, 500, 256), [C.text('gear', 1520, 130, 230, 92, C.gearText, (t) => amber(t))]);
        }
        if (C.strip(o) && o.centre !== 'stock') {
            // the car's own bottom strip (the default): the dials centred either side of the display, above the
            // strip (which shows the gear: the display shows the speed large)
            return [C.flat('bg', 0, 0, 1920, 720, 'bg')].concat(dialSet(o, 'speed', 470, 328, 600), dialSet(o, 'rpm', 1450, 328, 600), display(o, 846, 200, 228, 300, false));
        }
        // full screen: the speedometer left, the tach left of the KOMBI's dark box (with the stock centre: small,
        // between them), the display between; right of the box the electric range and the charge
        const stock = o.centre === 'stock', S = 520, cy = 392;
        const list = [C.flat('bg', 0, 0, stock ? 566 : 1920, 720, 'bg')].concat(dialSet(o, 'speed', 300, cy, S), stock ? dialSet(o, 'rpm', 1256, cy, 296) : dialSet(o, 'rpm', 1120, cy, S));
        if (stock) list.push(C.flat('bgR', 1104, 0, 816, 720, 'bg'));
        const RX = 1672, RW = 216, elec = (t) => (C.engineFocus(o) ? amber(t) : { color: [t.ev, 1], glow: [t.ev, 0.3] });
        list.push(...C.reading('elec', RX, 330, RW, 44, C.focus.range(o), C.focus.rangeLabel(o), elec, lbl),
            C.text('socTxt', RX, 446, RW, 44, C.focus.charge(o), elec),
            C.bar('soc', RX + 8, 502, RW - 16, 16, C.focus.bar(o), (t) => ({ track: t.track, fill0: C.engineFocus(o) ? t.amber : t.ev, fill1: C.engineFocus(o) ? t.amber : t.ev, redc: t.red, tip: t.rimGlow, tick: t.dim, num: t.num }), 16));
        if (stock) return list;
        return list.concat(display(o, 574, 150, 278, 450, true));
    },
};
