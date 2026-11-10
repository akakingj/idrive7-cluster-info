'use strict';
/**
 * layout_sport.js - "Sport": the sport display. After bimmer-lab's Sport theme for Cluster Themes (MIT, Copyright
 * (c) 2026 bimmer-lab, github.com/bimmer-lab/apps): its arrangement and its look, redrawn with this app's engine
 * (every piece a shader on the cluster's own GPU, the chevrons in their own shader, CHEVRON_FS), in its wide face
 * (Michroma; font.js 'wide'), fitted to the G05's glass, the KOMBI's boxes and the car's own bottom strip, and
 * made for a plug-in hybrid.
 *
 * A blue chevron on the left fills with the speed (its scale 0-100 in 20s, then in 40s), a red one on the right
 * with the engine speed (the battery's power, 0-100 kW, in an electric drive), each with a white marker at the
 * reading, a bright outer line, a thin inner line, and lines along the top and bottom joining them. Between them
 * the speed and the gear, large; inside the chevrons' feet the fuel and the oil temperature on slanted bars; under
 * the bottom line a bar in two halves: the battery's power (boost on a petrol or diesel car, or with Show:
 * Engine) on blue, the battery's temperature (the coolant on a petrol or diesel car) on red.
 *
 * Nothing shows the time, the outside temperature or the fuel range: the car's own bottom strip shows them.
 */
const C = require('./layout_common');

const BASE = {
    bg: '#000000', text: '#ffffff', dim: '#8c949e', red: '#ff2a1f', ev: '#4ab4ff', regen: '#3ddc84',
    // the speed's chevron
    sTrack: '#2340c8', sFill0: '#86aec4', sFill1: '#bfe8f6', sLine: '#4f8dff', sNum: '#6f9cff',
    // the engine speed's
    rTrack: '#4a1418', rFill0: '#a0121c', rFill1: '#ff3a46', rLine: '#ff2a35', rNum: '#ff8090', shift: '#ffd21a',
    gTrack: '#3a3e46', gFill: '#f2f4f7', oilCold: '#3a8cff',
    barL0: '#1f3cae', barL1: '#0e1b5c', barLEdge: '#2f57e0', barR0: '#6c1820', barR1: '#360a0e', barREdge: '#8e1c26',
    icon: '#9fb0c8', glow: '#4f8dff',
};
const PALETTES = {
    comfort: {},
    sport: { sTrack: '#5a0e12', sFill0: '#c24a2a', sFill1: '#ffb08a', sLine: '#ff5a2a', sNum: '#ff8a6a', barL0: '#7a1c10', barL1: '#3a0c06', barLEdge: '#a8301c', glow: '#ff5a2a' },
    efficient: { sTrack: '#0e5a3a', sFill0: '#6fc8a0', sFill1: '#c4f6dc', sLine: '#35e08a', sNum: '#6fe0a8', rTrack: '#0e2a5a', rFill0: '#1f5ac8', rFill1: '#4ab4ff', rLine: '#3a8cff', rNum: '#8ac4ff',
        barL0: '#0f6a44', barL1: '#073420', barLEdge: '#1f9a62', barR0: '#16346e', barR1: '#0a1a38', barREdge: '#2a4f9a', glow: '#35e08a' },
};
const pal = (lookId) => Object.assign({}, BASE, PALETTES[lookId] || PALETTES.comfort);
const isNum = C.isNum;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const white = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.08] });
const col = (k, g) => (t) => ({ color: [t[k], 1], glow: [t[k], g || 0] });

/* bimmer-lab's Sport is drawn 88-674 px high; here it is pressed into 116-588 (the strip below 646, the warning
 * lights from 652): Y() takes its heights to ours */
const Y = (y) => Math.round(116 + (y - 118) * 0.94);
/* the highest a chevron's numeral's centre sits (the top ones under the glass's slanted corners otherwise) */
const NUM_TOP = 148;
/* the scales end short of the chevrons' tops (bimmer-lab's numerals stop below them): the scale's 1 at END of the path */
const END = 0.9;

/** The speed scale: the numerals (0 to 100 or 120 in 20s, then in 40s), and a speed's place on it, 0..1. */
function speedScale(o) {
    const k = 6, s1 = 20, s2 = 40, marks = o.speedUnit === 'kmh' ? 11 : 8;
    const t = (v) => (v <= k * s1 ? v / s1 : k + (v - k * s1) / s2) / marks;
    return { marks, nums: [k, s1, s2, 0], t };
}

/*
 * A chevron (CHEVRON_FS): pts A (the foot, 0), B (the corner), C (the top, 1) in screen px; its layer the box round
 * them with room for the numerals outside. side -1 left, 1 right.
 */
function chevron(key, side, pts, opts) {
    const [A, B, Cp] = pts, T = opts.T, out = (opts.numOff || 0) + 46, inn = T / 2 + 18;
    const xs = pts.map((p) => p[0]);
    const x0 = Math.round(side < 0 ? Math.min(...xs) - out : Math.min(...xs) - inn);
    const x1 = Math.round(side < 0 ? Math.max(...xs) + inn : Math.max(...xs) + out);
    const y0 = Math.round(Math.min(...pts.map((p) => p[1])) - (opts.numOff ? 56 : 12)), y1 = Math.round(Math.max(...pts.map((p) => p[1])) + (opts.numOff ? 56 : 12));
    const L = (p) => [p[0] - x0, p[1] - y0];
    return Object.assign({ key, kind: 'chevron', x: x0, y: y0, w: x1 - x0, h: y1 - y0, max: 1, sweep: true,
        params: { u_ab: L(A).concat(L(B)), u_c: L(Cp).concat([T, opts.glow || 0]), u_lines: opts.lines || [3, 1000, 0, 1], u_marks: opts.marks || [0, 0, 0, 0],
            u_nums: (opts.nums || [0, 0, 0, 0]).slice(0, 3).concat([NUM_TOP - y0]), u_red: [opts.red === undefined ? 2 : opts.red] },
        _pts: pts }, opts.extra || {});
}

module.exports = {
    id: 'sport',
    title: 'Sport',
    font: 'wide',
    stripGear: true,   // (the gear is one of the layout's two big readings: kept over the car's own strip too)
    stripFuel: false,  // (its own fuel bar, inside the speed's chevron)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const engine = C.engineFocus(o), ice = o.vehicle === 'ice', strip = C.strip(o), mcar = C.mCar(o);
        const map = o.centre === 'map' || o.centre === 'stock';
        // full screen the KOMBI's dark box (x 1410-1662, y 262-454) sits where the right chevron's corner turns:
        // there the corners turn lower (below the box), both alike
        const holes = !strip, cy = holes ? 466 : Y(318), bx = 208;
        // with the map the chevrons stand clear of its window (x 416-1504)
        const dx = map ? 34 : 0;
        const left = [[414 - dx, Y(614)], [bx - dx, cy], [305 - dx, Y(122)]];
        // (full screen the right one's top half stands in the gap between the dark box and the eDrive box, x
        // 1662-1770: steeper, and its numerals left out, ticks only)
        const squeezed = holes;
        const right = squeezed ? [[1920 - left[0][0], left[0][1]], [1736, 466], [1696, Y(122)]] : left.map(([x, y]) => [1920 - x, y]);
        const sOff = map ? 72 : 82, rNum = squeezed ? 0 : 30;
        const sp = speedScale(o), rs = C.rpmScale(o);
        const sVal = (d) => (isNum(d.speed) ? clamp01(sp.t(C.speedIn(o, d.speed))) * END : 0);
        const rVal = (d) => END * (C.electric(o, d) ? (isNum(d.kw) ? clamp01(d.kw / 100) : 0) : isNum(d.rpm) ? clamp01(d.rpm / 1000 / rs.max) : 0);
        const shiftAt = END * Math.max(0, rs.red - 1) / rs.max;
        const rTop = Math.round(Y(122) - 56);   // (the rpm chevron's layer's top, chevron())
        const bottomY = map ? 604 : Y(620), topY = Y(118);
        // (the stock centre full screen: its area, x 566-1104, left clear; the bottom line and bar parted round it)
        const parted = o.centre === 'stock' && !strip, gL = parted ? 800 : 960, gR = parted ? 1120 : 960;
        const list = [];
        if (map) {
            const around = o.centre === 'stock' && !strip ? [{ x: 0, y: 0, w: 566, h: 720 }, { x: 1104, y: 0, w: 816, h: 720 }] : C.aroundMap();
            around.forEach((b, i) => list.push(C.flat('bg' + i, b.x, b.y, b.w, b.h, 'bg')));
        } else list.push(C.flat('bg', 0, 0, 1920, 720, 'bg'));
        list.push(
            chevron('speedChev', -1, left, { T: 40, glow: 1, numOff: sOff, lines: [3, 9, 2.5, END], marks: [sp.marks, 30, sOff, 10], nums: sp.nums, value: sVal,
                extra: { colors: (t) => ({ track: t.sTrack, fill0: t.sFill0, fill1: t.sFill1, tip: t.text, line: t.sLine, redc: t.sLine, num: t.sNum }) } }),
            chevron('rpmChev', 1, right, { T: 40, glow: 1, numOff: 62, lines: [3, 9, 2.5, END], nums: [rs.max, 1, 1, 0], red: shiftAt, marks: [rs.max, rNum, 62, 10],
                extra: {
                    dyn: (d) => (C.electric(o, d) ? { u_marks: [4, rNum ? 26 : 0, 70, 10], u_nums: [4, 25, 25, NUM_TOP - rTop], u_red: [2] } : { u_marks: [rs.max, rNum, 62, 10], u_nums: [rs.max, 1, 1, NUM_TOP - rTop], u_red: [shiftAt] }),
                    colors: (t, d) => (C.electric(o, d) ? { track: '#0e2a5a', fill0: '#1f5ac8', fill1: t.ev, tip: t.text, line: t.ev, redc: t.shift, num: '#8ac4ff' }
                        : { track: t.rTrack, fill0: t.rFill0, fill1: t.rFill1, tip: t.text, line: t.rLine, redc: t.shift, num: t.rNum }),
                } }),
        );
        list[list.length - 2].value = sVal;
        list[list.length - 1].value = rVal;
        // the lines along the top (two, from each chevron's top in) and the bottom (one, blue then red)
        const lx = left[2][0] - 24, rx = 1920 - lx;
        list.push(C.flat('topL', lx, topY, 718 - lx, 3, 'sLine'), C.flat('topR', 1202, topY, rx - 1202, 3, 'rLine'));
        if (!map) list.push(C.flat('topL2', left[2][0] + 34, topY + 9, 704 - left[2][0] - 34, 2, 'sLine'), C.flat('topR2', 1216, topY + 9, 1920 - left[2][0] - 34 - 1216, 2, 'rLine'));
        list.push(C.flat('botL', left[0][0] - 26, bottomY, gL - left[0][0] + 26, 3, 'sLine'), C.flat('botR', gR, bottomY, 1920 - left[0][0] + 26 - gR, 3, 'rLine'));
        // the scales' units over the top lines
        list.push(C.text('speedUnitTop', 330, Y(88), 140, 26, C.speedUnit(o), col('sNum'), { align: 0 }),
            C.text('rpmUnit', 1430, Y(86), 186, 26, (d) => (C.electric(o, d) ? 'kW' : '1/min x 1000'), (t, d) => ({ color: [C.electric(o, d) ? t.ev : t.rLine, 1], glow: [t.rLine, 0] }), { align: 1 }));
        // the speed and the gear (with the map: beside its window; an M car's KOMBI boxes: the gear between them)
        const gearC = (t, d) => ({ color: [C.gearText(d) === 'R' ? t.red : t.text, 1], glow: [t.glow, 0.06] });
        if (map) {
            list.push(C.text('speedDigits', 236, 236, 176, 60, (d) => C.speedText(o, d), white, { align: 1 }),
                C.text('speedUnit', 330, 300, 80, 24, C.speedUnit(o), col('sNum'), { align: 1 }),
                C.text('gear', 1510, holes ? 172 : 236, 170, 64, C.gearText, gearC, { align: 0 }));
        } else {
            list.push({ key: 'speedIcon', kind: 'icon', x: 494, y: Y(185), w: 34, h: 34, params: { u_icon: [13], u_line: [0] }, colors: (t) => ({ color: [t.icon, 1] }) },
                C.text('speedDigits', 420, Y(313), 280, 70, (d) => C.speedText(o, d), white, { align: 0.5 }),
                C.text('speedUnit', 596, Y(383), 100, 26, C.speedUnit(o), col('sNum'), { align: 0 }),
                mcar ? C.text('gear', 1060, 300, 144, 70, C.gearText, gearC) : C.text('gear', strip ? 1150 : 1120, Y(310), strip ? 280 : 280, 70, C.gearText, gearC));
            // the fuel and the oil temperature on slanted bars inside the chevrons' feet (full screen the oil's
            // top stops under the KOMBI's dark box)
            const bar = (key, pts, value, colors) => chevron(key, 0, pts, { T: 14, lines: [0, 1000, 0, 1], extra: { value, colors, sweep: true } });
            const fuelPts = [[540, Y(606)], [476, Y(522)], [412, Y(437)]];
            const oilTop = holes ? [1474, 462] : [1508, Y(437)];
            const oilPts = [[1380, Y(606)], [(1380 + oilTop[0]) / 2, (Y(606) + oilTop[1]) / 2], oilTop];
            list.push(bar('fuelBar', fuelPts, (d) => (isNum(d.fuelPct) ? d.fuelPct / 100 : 0),
                (t, d) => ({ track: t.gTrack, fill0: t.gFill, fill1: t.gFill, tip: isNum(d.fuelPct) && d.fuelPct < 12 ? t.red : t.gFill, line: t.gTrack, redc: t.red, num: t.dim })),
            bar('oilBar', oilPts, (d) => (isNum(d.oil) ? clamp01((d.oil - 50) / 100) : 0),
                (t, d) => ({ track: t.gTrack, fill0: t.oilCold, fill1: isNum(d.oil) && d.oil >= 130 ? t.red : t.gFill, tip: t.gFill, line: t.gTrack, redc: t.red, num: t.dim })));
            const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10);
            list.push(C.text('fuelL1', 456, Y(441), 50, 28, '1', white), C.text('fuelL2', 500, Y(516), 70, 28, '1/2', white), C.text('fuelL0', 562, Y(593), 50, 28, '0', white),
                { key: 'fuelIcon', kind: 'icon', x: 546, y: Y(556), w: 26, h: 26, params: { u_icon: [4], u_line: [0] }, colors: (t) => ({ color: [t.icon, 1] }) },
                C.text('oilL2', holes ? 1344 : 1400, holes ? 456 : Y(441), holes ? 112 : 76, 28, holes ? tl(150) + '°' + (o.tempUnit === 'c' ? 'C' : 'F') : tl(150), white, { align: 1 }), C.text('oilL1', 1336, Y(516), 76, 28, tl(100), white, { align: 1 }),
                C.text('oilL0', 1286, Y(593), 76, 28, tl(50), white, { align: 1 }),
                ...(holes ? [] : [C.text('oilUnit', 1412, Y(476), 44, 22, '°' + (o.tempUnit === 'c' ? 'C' : 'F'), col('dim'), { align: 0.5 })]),
                { key: 'oilIcon', kind: 'icon', x: 1332, y: Y(556), w: 26, h: 26, params: { u_icon: [1], u_line: [0] }, colors: (t) => ({ color: [t.icon, 1] }) });
        }
        // the bar under the bottom line: the battery's power (boost) on blue, the battery's (coolant's) temperature on red
        const by = map ? 610 : 598, bh = map ? 36 : 40, bx0 = 452, bx1 = 1468;
        const power = engine || ice
            ? { txt: (d) => (d.engineOn === false ? 'OFF' : isNum(d.boostActual) ? (o.speedUnit === 'kmh' ? d.boostActual.toFixed(2) : (d.boostActual * 14.5038).toFixed(1)) : '--'), unit: o.speedUnit === 'kmh' ? 'BAR' : 'PSI', c: white }
            : { txt: (d) => (isNum(d.kw) ? (Math.abs(d.kw) < 10 ? d.kw.toFixed(1) : String(Math.round(d.kw))) : '--'), unit: 'kW', c: (t, d) => ({ color: [isNum(d.kw) && d.kw < -0.3 ? t.regen : t.text, 1], glow: [t.glow, 0.08] }) };
        const temp = engine || ice ? { icon: 0, v: (d) => d.coolant, hot: 118 } : { icon: 6, v: (d) => d.battTemp, hot: 45 };
        list.push({ key: 'barL', kind: 'panel', x: bx0, y: by, w: gL - bx0, h: bh, params: { u_box: [3, 1.5, 0.3, 1] }, colors: (t) => ({ top: t.barL0, bottom: t.barL1, border: t.barLEdge }) },
            { key: 'barR', kind: 'panel', x: gR, y: by, w: bx1 - gR, h: bh, params: { u_box: [3, 1.5, 0.3, 1] }, colors: (t) => ({ top: t.barR0, bottom: t.barR1, border: t.barREdge }) },
            C.text('power', gL - 260, by + 6, 170, bh - 10, power.txt, power.c, { align: 1 }),
            C.text('powerUnit', gL - 82, by + 12, 70, bh - 20, power.unit, col('dim'), { align: 0 }),
            { key: 'tempIcon', kind: 'icon', x: gR + 36, y: by + 6, w: bh - 12, h: bh - 12, params: { u_icon: [temp.icon], u_line: [0] }, colors: (t) => ({ color: [t.icon, 1] }) },
            C.text('temp', gR + 76, by + 6, 110, bh - 10, (d) => (isNum(temp.v(d)) ? String(Math.round(C.tempIn(o, temp.v(d)))) : '--'),
                (t, d) => ({ color: [isNum(temp.v(d)) && temp.v(d) >= temp.hot ? t.red : t.text, 1], glow: [t.glow, 0.08] }), { align: 1 }),
            C.text('tempUnit', gR + 192, by + 12, 50, bh - 20, '°' + (o.tempUnit === 'c' ? 'C' : 'F'), col('dim'), { align: 0 }));
        return list;
    },
    /** (for the tests: a speed in mph on the mph chevron, 0..1 of its path) */
    _speedFrac: (mph) => clamp01(speedScale({ speedUnit: 'mph' }).t(mph)) * END,
};
