'use strict';
/**
 * check_runtime.js - every layout run by its own engine (tools/scene.js) through the settings this build adds
 * (readouts, small gauges, units, the shift point and its cold guard, the amber zone) and through awkward car
 * data (none yet, the engine off, a cold engine, a plug-in hybrid, numbers the car sends as strings, out-of-range
 * values), several ticks each: what throws, which uniform or value is not a finite number, which text reads
 * 'NaN', 'undefined', 'null' or 'Infinity'.
 *   node tools/check_runtime.js [layout,...]
 */
const path = require('path');
const { makeScene } = require('./scene');
const ROOT = path.join(__dirname, '..');
const { LAYOUTS } = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
const SPEC = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'app.json'));

const defaults = {};
SPEC.settings.forEach((s) => { defaults[s.key] = s.default; });
const asOptions = (s) => Object.assign({}, s, {
    redline: Number(s.redline), rpmMax: Number(s.rpmMax), boxClear: s.boxClear === 'on', boxBezel: s.boxBezel === 'on',
    cluster: s.cluster === 'm' ? 'm' : 'standard', bottomStrip: s.bottomStrip === 'layout' ? 'layout' : 'stock',
});

const full = { speed: 88, rpm: 3400, gear: 4, stage: 'D', engineOn: true, oil: 96, coolant: 90, gearbox: 78, iat: 33, outside: 9, boostActual: 0.9, boostTarget: 1.0,
    torque: 310, enginePower: 110, pedal: 64, throttle: 48, timing: 12.5, hpfp: 220, lpfp: 5.2, fuelPct: 55, frange: 420, mode: 'SPORT', driveMode: 'SPORT', gLong: 0.2, gLat: 0.1,
    tyres: { p: { FL: 2.4, FR: 2.4, RL: 2.5, RR: 2.5 }, t: { FL: 30, FR: 31, RL: 32, RR: 31 } } };
const DATA = {
    'no data yet': {},
    'driving': full,
    'engine off': Object.assign({}, full, { rpm: 0, engineOn: false, speed: 0, gear: 0, stage: 'P', torque: 0, enginePower: 0, pedal: 0 }),
    'cold engine': Object.assign({}, full, { oil: 25, coolant: 30, rpm: 4400 }),
    'at the shift point': Object.assign({}, full, { rpm: 5900, oil: 95 }),
    'over the scale': Object.assign({}, full, { rpm: 9500, speed: 330, oil: 160, coolant: 140, gearbox: 150, iat: 95, boostActual: 2.4, torque: 700, enginePower: 400, pedal: 104, timing: -12 }),
    'strings and nulls': Object.assign({}, full, { oil: '96', rpm: null, gearbox: undefined, iat: NaN, boostActual: 'x', torque: Infinity, pedal: null, enginePower: NaN }),
    'plug-in hybrid': Object.assign({}, full, { soc: 64, kw: -12, kwOut: 80, kwIn: 40, erange: 31, battTemp: 27, mode: 'ELECTRIC' }),
};
const READ = ['iat', 'gearbox', 'oil', 'coolant', 'boost', 'power', 'torque', 'throttle', 'pedal', 'timing'];
const GAUGE = ['auto', 'coolant', 'oil', 'iat', 'gearbox', 'boost', 'power', 'torque', 'throttle', 'pedal', 'timing', 'fuel'];
const SETS = [{ tag: 'defaults' }];
READ.forEach((k, i) => SETS.push({ tag: 'readouts ' + k, infoLow: READ[(i + 7) % READ.length], infoA: k, infoB: READ[(i + 3) % READ.length], infoMain: READ[(i + 5) % READ.length], gaugeSpeed: GAUGE[i + 1], gaugeRpm: GAUGE[(i + 4) % GAUGE.length] }));
SETS.push({ tag: 'off, fuel', infoA: 'off', infoB: 'off', gaugeSpeed: 'fuel', gaugeRpm: 'auto' });
SETS.push({ tag: 'imperial', speedUnit: 'mph', tempUnit: 'f', torqueUnit: 'lbft', pressUnit: 'kpa', powerUnit: 'kw', gaugeSpeed: 'boost', gaugeRpm: 'gearbox' });
SETS.push({ tag: 'no cold guard, no amber', coldGuard: 'off', amberRpm: 0, shiftBefore: 0 });
SETS.push({ tag: 'wide amber, far shift', amberRpm: 2000, shiftBefore: 1000, coldLimit: 3000, warmOil: 100, redline: 5000, rpmMax: 6000 });
SETS.push({ tag: 'top end', redline: 8000, rpmMax: 9000 });
// the Car profile's ends (its values are all in the settings' lists): the scale to 10000 with the red line at 9000, and
// to 5000 with it at 4000, the shift point 800 below
SETS.push({ tag: 'profile top', redline: 9000, rpmMax: 10000, shiftBefore: 800, coldLimit: 2000 });
SETS.push({ tag: 'profile bottom', redline: 4000, rpmMax: 5000, shiftBefore: 800, coldLimit: 2000, warmOil: 60 });
SETS.push({ tag: 'layout strip, map', bottomStrip: 'layout', centre: 'map' });
SETS.push({ tag: 'stock centre', centre: 'stock' });
SETS.push({ tag: 'M cluster', cluster: 'm', bottomStrip: 'layout' });
SETS.push({ tag: 'plug-in hybrid', vehicle: 'phev' });
SETS.push({ tag: 'shift warning, no colours', shiftWarn: 'on', tempTone: 'off' });
SETS.push({ tag: 'shift warning, gauges', shiftWarn: 'on', gaugeSpeed: 'coolant', gaugeRpm: 'gearbox', infoA: 'oil', infoB: 'coolant', infoMain: 'gearbox' });

const bad = (v) => typeof v === 'number' && !isFinite(v);
const problems = new Map();
const note = (k, v) => { if (!problems.has(k)) problems.set(k, v); };
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
let runs = 0;
LAYOUTS.filter((L) => !ONLY || ONLY.indexOf(L.id) >= 0).forEach((L) => {
    ['comfort', 'sport'].forEach((look) => SETS.forEach((set) => {
        const o = asOptions(Object.assign({}, defaults, set));
        const warns = [];
        const log = { info() {}, warn: (m) => warns.push(String(m)), error: (m, e) => warns.push(String(m) + ' ' + (e || '')) };
        let sc;
        try { sc = makeScene({ layout: L.id, look, options: o, data: {}, log }); } catch (e) { note(L.id + ' / ' + set.tag, 'build threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); return; }
        Object.keys(DATA).forEach((dk) => {
            runs++;
            sc.setData(Object.assign({}, DATA[dk]));
            try { for (let i = 0; i < 3; i++) sc.engine._tick(); sc.engine._full(); } catch (e) { note(L.id + ' / ' + set.tag + ' / ' + dk, 'tick threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); return; }
            sc.client.layers.forEach((l) => {
                Object.keys(l.uniforms).forEach((u) => { if (l.uniforms[u].v.some(bad)) note(L.id + ' / ' + set.tag + ' / ' + dk + ' / ' + (l.opts.name || l.ref) + ' ' + u, 'not a number: ' + l.uniforms[u].v.join(' ')); });
            });
            (sc.engine._pieces ? sc.engine._pieces() : []).forEach((p) => {
                if (p.text !== null && p.text !== undefined && /NaN|undefined|null|Infinity|\[object/.test(String(p.text))) note(L.id + ' / ' + set.tag + ' / ' + dk + ' / ' + p.key, 'text "' + p.text + '"');
                if (p.value !== null && p.value !== undefined && bad(p.value)) note(L.id + ' / ' + set.tag + ' / ' + dk + ' / ' + p.key, 'value ' + p.value);
            });
        });
        warns.filter((w) => !/not connected|status/.test(w)).forEach((w) => note(L.id + ' / ' + set.tag, 'log: ' + w.slice(0, 200)));
        try { sc.engine.stop && sc.engine.stop(); } catch (e) { /* gone */ }
    }));
});
console.log(runs + ' runs (' + LAYOUTS.length + ' layouts x 2 looks x ' + SETS.length + ' settings x ' + Object.keys(DATA).length + ' car states)');
problems.forEach((v, k) => console.log('PROBLEM  ' + k + ': ' + v));
if (!problems.size) console.log('no throw, no non-number, no broken text');
process.exitCode = problems.size ? 1 : 0;
