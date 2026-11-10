'use strict';
/**
 * layout_sport.js - "Sport": bimmer-lab's Sport theme for Cluster Themes (MIT, Copyright (c) 2026 bimmer-lab,
 * github.com/bimmer-lab/apps; after BMW's Live Cockpit Sport view), as theirs: their shader for the whole view
 * (SDASH_FS: the blue speed bracket and the red rev bracket, the fuel and oil bars, the bottom bar) with their
 * layout's numbers, and every text where their layout puts it, in their faces (Michroma, Barlow Medium; font.js
 * 'wide'), the size and on the line theirs are (bimmer.js).
 *
 * Fitted to the G05: the whole view pressed a little in height (Y below) so it ends at the car's own bottom strip
 * (y 646) and above the warning lights; their time, fuel range, outside temperature and badge under the bottom
 * bar left out (the car's strip shows them); the top numeral and the top line kept out of the glass's corner and
 * the camera's cowl. With the Waze map their window (the map drawn there, map_window.js) and their map-up places.
 * Full screen without the car's strip the KOMBI's own gear box (x 1410-1662, y 262-454) shows over a part of the
 * rev bracket, and the readings round it step aside. A plug-in hybrid: the bottom bar's blue half reads the
 * battery's power (boost on a petrol or diesel car, or with Show: Engine).
 */
const C = require('./layout_common');
const B = require('./bimmer');

/* their theme (hud_themes.js sportdash): one look */
const PAL = {
    bg: '#000000', text: '#f4f7fc', fg: '#f4f7fc', dim: '#96aacd', faint: '#606e87', sblue: '#78aaf5', spink: '#ec8c8c', sred: '#eb3c46',
    red: '#ff2a2a', regen: '#3ddc84', glow: '#3cd7ff',
};
const pal = () => Object.assign({}, PAL);
const isNum = C.isNum;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* their view is 674 px high (the bottom bar's foot); here it ends at 646: their heights pressed by SY from the
 * top line (y 120) down */
const TOP = 120, SY = (C.STRIP_Y - TOP) / (674 - TOP);
const Y = (y) => Math.round(TOP + (y - TOP) * SY);
const RPM_MAX = 7000;   // their scale: 0-7 (ticks 7)

/* their map window ("hole" [524, 120, 872, 480], inset 10), pressed as the rest */
const WINDOW = { x: 534, y: Y(130), w: 852, h: Y(130 + 460) - Y(130) };

module.exports = {
    id: 'sport',
    title: 'Sport',
    font: 'wide',
    stripGear: true,    // (the gear is one of its two big readings: kept over the car's own strip)
    stripFuel: false,   // (its own fuel bar)
    mapWindow: WINDOW,
    gearNumber: true,   // (the gear's number alone, as theirs)
    speedGauge: false,  // (its speed bracket reads through dyn, u_speed: the engine eases the engine speed alone)
    palette: pal,
    gearText: C.gearText,

    pieces(o) {
        const strip = C.strip(o), map = o.centre === 'map', stock = o.centre === 'stock' && !strip;
        const us = o.speedUnit !== 'kmh', scale = B.SPEED_SCALE[us ? 'us' : 'metric'];
        const engine = C.engineFocus(o) || o.vehicle === 'ice';
        const [redFrom, orange] = B.redMarks(o, RPM_MAX);
        const T = (key, box, font, txt, colors, align) => B.text('wide', key, box, font, txt, colors, align, Y);
        // (the stock centre full screen: its area, x 566-1104, cut out of the view and left to the cluster)
        const list = [];
        list.push({
            key: 'sport', kind: 'sdash', x: 0, y: 0, w: 1920, h: strip ? C.STRIP_Y : 720,
            params: {
                u_geo: [Y(120), Y(317), Y(620), 180], u_k: [0.58 / SY, 0.75 / SY, 30], u_w: [40], u_inner: [59],
                u_scale: [Y(610), Y(155)], u_ticks: [8, 7], u_redFrom: [redFrom], u_orange: [orange],
                u_fuelSeg: [412, Y(440), 537, Y(607)], u_oilSeg: [1508, Y(440), 1383, Y(607)],
                // the map window cut see-through (the map drawn in it); the stock centre's area likewise
                u_hole: map ? [WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h] : stock ? [566, 0, 538, 720] : [0, 0, 0, 0], u_holeR: [map ? 28 : 0],
                u_strip: [425, Y(632), Math.round(42 * SY), 26], u_topEnd: [726],
            },
            // the engine speed eased by the engine (u_value); the speed, the fuel and the oil as they come
            value: (d) => (isNum(d.rpm) ? clamp01(d.rpm / RPM_MAX) : 0), max: 1, sweep: true,
            dyn: (d) => ({
                u_speed: [isNum(d.speed) ? Math.round(B.scaleFrac(C.speedIn(o, d.speed), scale) * 500) / 500 : 0],
                u_fuel: [isNum(d.fuelPct) ? Math.round(clamp01(d.fuelPct / 100) * 500) / 500 : 0],
                u_oil: [isNum(d.oil) ? Math.round(clamp01((d.oil - 50) / 100) * 500) / 500 : 0],
            }),
        });
        // the scales' numerals: the one nearest the reading white (theirs: "near")
        const nearSpeed = (i) => (t, d) => {
            const v = isNum(d.speed) ? B.scaleFrac(C.speedIn(o, d.speed), scale) * 8 : -9;
            return { color: [Math.round(v) === i ? t.fg : t.sblue, 1], glow: [t.sblue, 0] };
        };
        const nearRpm = (i) => (t, d) => ({ color: [isNum(d.rpm) && Math.round(d.rpm / 1000) === i ? t.fg : t.spink, 1], glow: [t.spink, 0] });
        const SPD = [[248, 596], [206, 540], [164, 483], [122, 426], [82, 369], [51, 312], [66, 255], [96, 198], [142, 142]];
        // (the top one nudged right of the glass's slanted corner: its right edge where theirs is)
        SPD.forEach(([x, y], i) => list.push(T('spd' + i, [x, y, i === 8 ? 96 : 110, 27], 's_scale', String(scale[i]), nearSpeed(i), 'right')));
        // (full screen 2 a few px right of the KOMBI's gear box, 5 a few down from its eDrive box)
        const RPM = [[1562, 596], [1610, 532], [strip ? 1658 : 1664, 466], [1706, 402], [1749, 336], [1752, strip ? 272 : 282], [1719, 206], [1682, 142]];
        RPM.forEach(([x, y], i) => list.push(T('rpm' + i, [x, y, 40, 27], 's_scale', String(i), nearRpm(i), 'left')));
        list.push(T('mphCap', [338, 88, 80, 29], 's_unit', C.speedUnit(o), B.role('sblue'), 'center'),
            T('rpmCap', [1430, 86, 200, 29], 's_unit', '1/min x 1000', B.role('sred'), 'center'));
        // their gear: the number alone (P, R or N in park, reverse or neutral; the selector's letter with no gear)
        const gearNum = (d) => { const g = C.gearText(d); return /^[DSM]\d+$/.test(g) ? g.slice(1) : g; };
        const gearC = (t, d) => ({ color: [B.shiftNow(o, d) ? t.red : t.fg, 1], glow: [t.fg, 0] });
        if (map) {
            // their map-up places (full screen the gear above the KOMBI's box)
            list.push(T('speedDigits', [285, 286, 230, 68], 's_speed', (d) => C.speedText(o, d), B.role('fg'), 'center'),
                T('speedUnit', [360, 358, 80, 29], 's_unit', C.speedUnit(o), B.role('sblue'), 'center'),
                T('gear', [1415, strip ? 230 : 182, 200, 65], 's_gear', gearNum, gearC, 'center'));
        } else {
            list.push(B.icon('driveIcon', 490, Y(182), 40, 36, 'gauge', 'dim'),
                T('speedDigits', [420, 313, 280, 68], 's_speed', (d) => C.speedText(o, d), B.role('fg'), 'center'),
                T('speedUnit', [580, 382, 80, 29], 's_unit', C.speedUnit(o), B.role('sblue'), 'center'),
                // (an M car's KOMBI boxes in the middle: the gear above the right one)
                T('gear', [1185, C.mCar(o) ? 196 : 310, 210, 65], 's_gear', gearNum, gearC, 'center'));
            if (!stock) {
                // the fuel and oil bars' labels (the bars are the shader's); full screen the oil's top label steps
                // left of the KOMBI's box
                const tl = (c) => String(Math.round(C.tempIn(o, c) / 10) * 10), tu = '°' + (o.tempUnit === 'c' ? 'C' : 'F');
                list.push(T('fuelFull', [446, 441, 40, 22], 's_gl', '1', B.role('fg'), 'center'),
                    T('fuelHalf', [504, 516, 60, 22], 's_gl', '1/2', B.role('fg'), 'center'),
                    B.icon('fuelIcon', 549, Y(551), 26, 30, 'fuel', 'dim'),
                    T('fuelEmpty', [567, 593, 30, 22], 's_gl', '0', B.role('fg'), 'center'),
                    T('oilHot', [strip ? 1405 : 1336, strip ? 441 : 446, 70, 22], 's_gl', tl(150), B.role('fg'), 'center'),
                    T('oilUnit', [1406, 474, 40, 29], 's_unit', tu, B.role('dim'), 'center'),
                    T('oilMid', [1343, 516, 70, 22], 's_gl', tl(100), B.role('fg'), 'center'),
                    B.icon('oilIcon', 1332, Y(554), 36, 24, 'oilcan', 'dim'),
                    T('oilCold', [1291, 593, 70, 22], 's_gl', tl(50), B.role('fg'), 'center'));
            }
        }
        // the bottom bar's readings: the battery's power (boost) on blue, the coolant on red
        const power = engine
            ? { txt: (d) => (d.engineOn === false ? 'OFF' : isNum(d.boostActual) ? (us ? (d.boostActual * 14.5038).toFixed(1) : d.boostActual.toFixed(2)) : '--'), unit: us ? 'PSI' : 'bar' }
            : { txt: (d) => (isNum(d.kw) ? (Math.abs(d.kw) < 10 ? d.kw.toFixed(1) : String(Math.round(d.kw))) : '--'), unit: 'kW' };
        list.push(T('power', [680, 640, 160, 26], 's_val', power.txt, B.role('fg'), 'right'),
            T('powerUnit', [846, 640, 60, 29], 's_unit', power.unit, B.role('dim'), 'left'),
            B.icon('therm', 998, Y(638), 24, 30, 'therm', 'dim'),
            T('coolant', [1020, 640, 90, 26], 's_val', (d) => (isNum(d.coolant) ? String(Math.round(C.tempIn(o, d.coolant))) : '--'), B.role('fg'), 'right'),
            T('coolantUnit', [1116, 640, 50, 29], 's_unit', '°' + (o.tempUnit === 'c' ? 'C' : 'F'), B.role('dim'), 'left'));
        if (stock) return list.filter((p) => p.kind === 'flat' || p.kind === 'sdash' || p.x + p.w <= 566 || p.x >= 1104);
        return list;
    },
};
