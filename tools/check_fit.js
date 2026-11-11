'use strict';
/**
 * check_fit.js - every text a reading can put in a layout (the small gauges in the analog dials, the readouts),
 * at its longest figures, measured against its box with the layout's own glyphs: what would not fit (the font
 * sets glyphs closer down to 85% of their advance, past that the line runs over the box).
 *   node tools/check_fit.js
 */
const path = require('path');
require('./scene');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'apps', 'akakingj_cluster_layouts');
const C = require(path.join(APP, 'layout_common.js'));
const font = require(path.join(APP, 'font.js'));
const { LAYOUTS } = require(path.join(APP, 'layouts.js'));
const isFn = (f) => typeof f === 'function';

/* the widest figures each reading can show */
const WORST = C.READOUT_SAMPLES;
const base = { vehicle: 'ice', speedUnit: 'kmh', tempUnit: 'c', torqueUnit: 'kgm', pressUnit: 'psi', powerUnit: 'hp', redline: 6000, rpmMax: 7000, bottomStrip: 'stock', centre: 'info', timeZone: 'utc+9' };
const KEYS = Object.keys(C.GAUGES), RKEYS = Object.keys(C.READOUTS);
const variants = [];
KEYS.forEach((k) => variants.push({ gaugeSpeed: k, gaugeRpm: k, tag: 'gauge ' + k }));
RKEYS.forEach((k) => variants.push({ infoA: k, infoB: k, infoMain: k, tag: 'readout ' + k }));
['psi', 'bar', 'kpa'].forEach((p) => variants.push({ pressUnit: p, gaugeSpeed: 'boost', gaugeRpm: 'boost', infoA: 'boost', infoB: 'boost', infoMain: 'boost', tag: 'boost in ' + p }));
['hp', 'ps', 'kw'].forEach((p) => variants.push({ powerUnit: p, gaugeSpeed: 'power', gaugeRpm: 'power', infoA: 'power', infoB: 'power', infoMain: 'power', tag: 'power in ' + p }));
['nm', 'kgm', 'lbft'].forEach((p) => variants.push({ torqueUnit: p, gaugeSpeed: 'torque', gaugeRpm: 'torque', infoA: 'torque', infoB: 'torque', infoMain: 'torque', tag: 'torque in ' + p }));
variants.push({ tempUnit: 'f', gaugeSpeed: 'gearbox', gaugeRpm: 'oil', tag: 'temperatures in F' });
// and each in every arrangement: the car's own bottom strip or the layout's, the readings, the map or the stock centre
const MODES = [];
[['stock', 'info'], ['stock', 'map'], ['stock', 'stock'], ['layout', 'info'], ['layout', 'map'], ['layout', 'stock']].forEach(([bottomStrip, centre]) =>
    variants.forEach((v) => MODES.push(Object.assign({}, v, { bottomStrip, centre, tag: v.tag + ', strip ' + bottomStrip + ', centre ' + centre }))));

const bad = new Map();
let checked = 0;
const LIST = process.argv[2] ? process.argv[2].split(',') : LAYOUTS.map((L) => L.id);
LAYOUTS.filter((L) => LIST.indexOf(L.id) >= 0).forEach((L) => {
    const a = font.atlas(L.font || 'bold');
    MODES.forEach((v) => {
        const o = Object.assign({}, base, v);
        let pieces;
        try { pieces = L.pieces(o); } catch (e) { bad.set(L.id + ' ' + v.tag, 'pieces threw ' + e); return; }
        pieces.filter((p) => p.kind === 'text').forEach((p) => {
            WORST.forEach((d) => {
                let s;
                try { s = isFn(p.text) ? String(p.text(d, {})) : String(p.text); } catch (e) { return; }
                if (!s) return;
                const chars = Array.from(s);
                const sum = chars.reduce((x, ch) => { const c = a.code(ch); return x + (c < 0 ? 0.3 : ch === ' ' ? Math.max(a.adv[c], 0.32) : a.adv[c]); }, 0);
                const room = p.w / p.h;
                checked++;
                if (sum * 0.85 > room + 0.02) {
                    const k = L.id + ' / ' + p.key + ' "' + s + '"';
                    if (!bad.has(k)) bad.set(k, 'needs ' + (sum * 0.85).toFixed(2) + ' of ' + room.toFixed(2) + ' (' + v.tag + ')');
                }
            });
        });
    });
});
console.log(checked + ' texts measured');
bad.forEach((v, k) => console.log('OVER  ' + k + ': ' + v));
if (!bad.size) console.log('every text fits its box');
process.exitCode = bad.size ? 1 : 0;
