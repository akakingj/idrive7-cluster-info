'use strict';
/**
 * test_readouts.js - the readouts a petrol or diesel car picks for its displays (Settings > Readout 1, Readout 2,
 * Main readout) and the engine's power and pedal readings behind them.
 *   node tools/test_readouts.js
 */
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
require('./scene');   // (./kit/ as kit/runtime, as on the car)
const C = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layout_common.js'));
const R = require(path.join(ROOT, 'apps', 'akakingj_cluster_centre', 'readings.js'));
const SPEC = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'app.json'));

let n = 0;
const check = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const o = (x) => Object.assign({ vehicle: 'ice', speedUnit: 'kmh', tempUnit: 'c', torqueUnit: 'kgm', pressUnit: 'psi', powerUnit: 'hp' }, x || {});
// 2.0 l petrol at 5000 rpm: 300 Nm is 157 kW, 211 hp
const d = { iat: 31, gearbox: 78, oil: 98, coolant: 90, boostActual: 1.0, torque: 300, rpm: 5000, enginePower: 300 * 5000 / 9549.3, pedal: 85.4, throttle: 72.6, timing: 6, engineOn: true };
const narrow = { w: 120, h: 30 }, wide = { w: 500, h: 34 };

check('readout 1 and 2: the defaults are intake air and gearbox oil, short where narrow', () => {
    assert.strictEqual(C.stripInfoA(o(), narrow)(d), 'IAT 31°');
    assert.strictEqual(C.stripInfoB(o(), narrow)(d), 'TRANS 78°');
});
check('readouts: long names and units where the box has room', () => {
    assert.strictEqual(C.stripInfoA(o(), wide)(d), 'INTAKE AIR 31°');
    assert.strictEqual(C.stripInfoA(o({ infoA: 'boost' }), wide)(d), 'BOOST 14.5 psi');
});
check('readouts: every choice, short', () => {
    const t = (k) => C.stripInfoA(o({ infoA: k }), narrow)(d);
    assert.strictEqual(t('boost'), 'BST 14.5');
    assert.strictEqual(t('power'), 'HP 211');
    assert.strictEqual(t('torque'), 'TQ 30.6');
    assert.strictEqual(t('throttle'), 'THR 73%');
    assert.strictEqual(t('pedal'), 'PDL 85%');
    assert.strictEqual(t('oil'), 'OIL 98°');
    assert.strictEqual(t('coolant'), 'CLT 90°');
    assert.strictEqual(t('timing'), 'TIM 6.0°');
    assert.strictEqual(C.stripInfoA(o({ infoA: 'off' }), narrow), '');
});
check('power unit: hp, PS or kW', () => {
    assert.strictEqual(C.stripInfoA(o({ infoA: 'power', powerUnit: 'ps' }), narrow)(d), 'PS 214');
    assert.strictEqual(C.stripInfoA(o({ infoA: 'power', powerUnit: 'kw' }), narrow)(d), 'KW 157');
});
check('main readout: the engine torque by default, else the one picked, with its unit and label', () => {
    assert.strictEqual(C.focus.power(o())(d), '30.6 kgm');
    assert.strictEqual(C.focus.powerLabel(o(), true), 'ENGINE TORQUE');
    assert.strictEqual(C.focus.power(o({ infoMain: 'power' }))(d), '211 hp');
    assert.strictEqual(C.focus.powerLabel(o({ infoMain: 'power' }), true), 'ENGINE POWER');
    assert.strictEqual(C.focus.powerLabel(o({ infoMain: 'power' }), false), 'POWER');
    assert.strictEqual(C.focus.power(o({ infoMain: 'boost' }))(d), '14.5 psi');
    assert.strictEqual(C.focus.power(o({ infoMain: 'pedal' }))(d), '85%');
    assert.strictEqual(C.focus.power(o({ infoMain: 'throttle' }))(d), '73%');
    assert.strictEqual(C.focus.power(o({ infoMain: 'iat' }))(d), '31°');
    assert.strictEqual(C.focus.power(o({ infoMain: 'boost' }))(Object.assign({}, d, { engineOn: false })), 'OFF');
    assert.strictEqual(C.focus.power(o({ infoMain: 'power' }))({}), '--');
    assert(Math.abs(C.focus.mainFrac(o({ infoMain: 'pedal' }))(d) - 0.854) < 1e-9);
});
check('a plug-in hybrid keeps its battery readings', () => {
    const p = o({ vehicle: 'phev', infoA: 'boost', infoMain: 'power' });
    assert.strictEqual(C.stripInfoA(p, narrow)({ battTemp: 27 }), 'BATT 27°');
    assert.strictEqual(C.focus.power(p)({ kw: 12.34 }), '+12 kW');
});
check('the engine unit reads what the readouts show', () => {
    const w = C.focus.needs(o({ infoA: 'timing', infoB: 'boost', infoMain: 'iat' }));
    ['timing', 'boostActual', 'iat'].forEach((k) => assert(w.indexOf(k) >= 0, k));
    assert(C.focus.needs(o()).indexOf('gearbox') >= 0);
});
check('the settings offer every readout, and the defaults are this build\'s', () => {
    const s = (k) => SPEC.settings.find((x) => x.key === k);
    ['infoA', 'infoB', 'infoMain'].forEach((k) => Object.keys(C.READOUTS).forEach((r) => assert(s(k).options.some((x) => x[0] === r), k + ' ' + r)));
    const want = { vehicle: 'ice', tankLitres: 59, speedUnit: 'kmh', tempUnit: 'c', torqueUnit: 'kgm', pressUnit: 'psi', powerUnit: 'hp', timeZone: 'utc+9', infoA: 'iat', infoB: 'gearbox', infoMain: 'torque', redline: 6000, rpmMax: 7000 };
    Object.keys(want).forEach((k) => assert.strictEqual(s(k).default, want[k], k));
    // (a number setting is a drop-down on the car: its steps, the default among them)
    SPEC.settings.filter((x) => x.type === 'number').forEach((x) => assert(Array.isArray(x.steps) && x.steps.indexOf(x.default) >= 0, x.key));
});
check('Cluster Centre: engine power and the pedal as readings', () => {
    const u = { temp: 'c', press: 'psi', speed: 'kmh', torque: 'kgm', power: 'hp' };
    const v = R.view('enginePower', d, u);
    assert.strictEqual(v.text + ' ' + v.unit, '211 hp');
    assert.strictEqual(R.view('enginePower', d, Object.assign({}, u, { power: 'ps' })).unit, 'PS');
    const p = R.view('pedal', d, u);
    assert.strictEqual(p.text + p.unit, '85%');
});
check('small gauges: the layout\'s own by default; any reading on its own scale, red zone and figures', () => {
    assert.strictEqual(C.gaugeOf(o({ gaugeSpeed: 'auto' }), 'speed'), null);
    assert.strictEqual(C.gaugeOf(o(), 'rpm'), null);
    const b = C.gaugeOf(o({ gaugeRpm: 'boost' }), 'rpm');
    assert.strictEqual(b.label, 'BOOST');
    assert.strictEqual(b.txt(d), '14.5 psi');
    assert(Math.abs(b.frac(d) - 1 / 1.6) < 1e-9 && b.redFrac > 1);
    const i = C.gaugeOf(o({ gaugeSpeed: 'iat' }), 'speed');
    assert.strictEqual(i.txt(d), '31°');
    assert(Math.abs(i.redFrac - 0.75) < 1e-9 && !i.hot(d) && i.hot({ iat: 65 }));
    assert.strictEqual(C.gaugeOf(o({ gaugeSpeed: 'power' }), 'speed').txt(d), '211 hp');
    assert.strictEqual(C.gaugeOf(o({ gaugeSpeed: 'throttle' }), 'speed').frac({}), 0);
    assert(C.focus.needs(o({ gaugeSpeed: 'timing', gaugeRpm: 'boost' })).indexOf('timing') >= 0);
    const s = SPEC.settings.find((x) => x.key === 'gaugeRpm');
    Object.keys(C.GAUGES).forEach((k) => assert(s.options.some((x) => x[0] === k), k));
    assert.strictEqual(s.default, 'auto');
});
check('shift point and red zone as the Redline app: the red line less 300, lower while the oil is cold', () => {
    const r = (x, oil) => C.shiftPoint(o(Object.assign({ redline: 6500, rpmMax: 7000 }, x)), { oil });
    assert.deepStrictEqual(r({}, 90), { rpm: 6200, red: 6500, cold: false });
    assert.deepStrictEqual(r({}, 30), { rpm: 4500, red: 4800, cold: true });
    assert.deepStrictEqual(r({}, 55), { rpm: 5350, red: 5650, cold: true });
    assert.deepStrictEqual(r({ coldGuard: 'off' }, 30), { rpm: 6200, red: 6500, cold: false });
    assert.deepStrictEqual(r({ shiftBefore: 500, coldLimit: 4000, warmOil: 70 }, 50), { rpm: 5000, red: 5500, cold: true });
    assert.strictEqual(r({}, undefined).cold, false);
    const B = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'bimmer.js'));
    assert(B.shiftNow(o({ redline: 6500 }), { rpm: 6200, oil: 90 }) && !B.shiftNow(o({ redline: 6500 }), { rpm: 6100, oil: 90 }));
    assert(B.shiftNow(o({ redline: 6500 }), { rpm: 4600, oil: 30 }));
    assert(Math.abs(B.redMarks(o({ redline: 6500 }), 8000, { oil: 30 })[0] - 4800 / 8000) < 1e-9);
    assert(Math.abs(B.redMarks(o({ redline: 6000 }), 8000, { oil: 90 })[1] - 5300 / 8000) < 1e-9);
    assert(Math.abs(B.redMarks(o({ redline: 6000, amberRpm: 1500 }), 8000, { oil: 90 })[1] - 4500 / 8000) < 1e-9);
    assert.strictEqual(B.redMarks(o({ redline: 6000, amberRpm: 0 }), 8000, { oil: 90 })[1], 2);
});
check('the pedal from the engine unit (as Live Data: 5814 / 480B, OBD 49), asked for while a readout shows it', () => {
    const { DME_KEYS } = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'data.js'));
    assert(DME_KEYS.indexOf('pedal') >= 0);
    ['akakingj_cluster_layouts', 'akakingj_cluster_centre'].forEach((a) => {
        const c = require(path.join(ROOT, 'apps', a, 'app.json')).config.dme.pedal;
        assert.deepStrictEqual(c.map((x) => x.did || 'OBD ' + x.obd), ['5814', '480B', 'OBD 49'], a);
        // raw 0x2000 (8192) x 0.01220703 = 100 % (100 / 8192 a bit)
        assert(Math.abs(8192 * c[0].factor - 100) < 0.01);
    });
    assert(C.focus.needs(o({ infoMain: 'pedal' })).indexOf('pedal') >= 0);
    assert(C.focus.needs(o({ gaugeRpm: 'pedal' })).indexOf('pedal') >= 0);
    assert(C.focus.needs(o({ infoLow: 'throttle' })).indexOf('throttle') >= 0);
    assert(C.focus.needs(o({ infoA: 'throttle' })).indexOf('pedal') < 0);
    assert(C.focus.needs(o()).indexOf('pedal') < 0);
});
check('the layout for the drive mode: Sport / ECO PRO when set, else Layout; the gear selector\'s S doesn\'t switch', () => {
    const L = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
    const S = { layout: 'analog_sport', layoutSport: 'sport', layoutEco: 'same' }, get = (k) => S[k];
    assert.strictEqual(L.layoutFor(get, { driveMode: 'COMFORT' }), 'analog_sport');
    assert.strictEqual(L.layoutFor(get, { driveMode: 'SPORT INDIVIDUAL' }), 'sport');
    assert.strictEqual(L.layoutFor(get, { driveMode: 'ECO PRO' }), 'analog_sport');
    assert.strictEqual(L.layoutFor(get, { driveMode: 'COMFORT', mode: 'S' }), 'analog_sport');
    assert.strictEqual(L.layoutFor(get, {}), 'analog_sport');
    assert.strictEqual(L.layoutFor((k) => (k === 'layoutSport' ? 'nope' : S[k]), { driveMode: 'SPORT' }), 'analog_sport');
});
check('temperatures in colour: blue while cold, red when hot, the piece\'s own colour between; off: as it was', () => {
    const base = () => ({ color: ['#ffffff', 1], glow: ['#ff7a1a', 0.6] });
    const c = C.toned(base, 'oil');
    assert.strictEqual(c({}, { oil: 40 }).color[0], '#4ab4ff');
    assert.strictEqual(c({}, { oil: 135 }).color[0], '#ff3b30');
    assert.strictEqual(c({}, { oil: 90 }).color[0], '#ffffff');
    assert.strictEqual(C.toned(base, 'iat')({}, { iat: 5 }).color[0], '#ffffff');
    // the oil amber while warming: from 60 °C up to Oil warm at (the cold-engine guard's range), as the Redline HUD
    const w = C.toned(base, 'oil', { warmOil: 80 });
    assert.strictEqual(w({}, { oil: 59 }).color[0], '#4ab4ff');
    assert.strictEqual(w({}, { oil: 70 }).color[0], '#ffc21a');
    assert.strictEqual(w({}, { oil: 80 }).color[0], '#ffffff');
    assert.strictEqual(C.toned(base, 'coolant', { warmOil: 80 })({}, { coolant: 70 }).color[0], '#ffffff', 'the oil only');
    const L = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
    const ps = L.byId('analog_sport').pieces(o({ bottomStrip: 'stock', centre: 'info', infoA: 'oil', infoB: 'gearbox', gaugeRpm: 'gearbox', tempGauge: 'scale' }));
    const col = (k, d) => ps.find((p) => p.key === k).colors({ red: '#ff0000', text: '#ffb066', glow: '#ff7a1a', dim: '#999999' }, d).color[0];
    assert.strictEqual(col('clock', { oil: 30 }), '#4ab4ff');
    assert.strictEqual(col('clock', { oil: 70 }), '#ffc21a', 'Oil warm at 80 (the default) passed on by layouts.js');
    assert.strictEqual(col('outside', { gearbox: 120 }), '#ff3b30');
    assert.strictEqual(col('oilNum', { gearbox: 40 }), '#4ab4ff');
    const off = L.byId('analog_sport').pieces(o({ bottomStrip: 'stock', centre: 'info', infoA: 'oil', tempTone: 'off' }));
    assert.notStrictEqual(off.find((p) => p.key === 'clock').colors({ red: '#ff0000', text: '#ffb066', glow: '#ff7a1a' }, { oil: 30 }).color[0], '#4ab4ff');
});
check('shift warning (off by default): the digital speed red at the shift point, in the layouts without their own', () => {
    const L = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
    const t = { red: '#ff0000', text: '#ffb066', glow: '#ff7a1a', dim: '#999999' };
    const sp = (x) => L.byId('analog_sport').pieces(o(Object.assign({ bottomStrip: 'stock', centre: 'info', redline: 6000, rpmMax: 7000 }, x))).find((p) => p.key === 'speedDigits');
    assert.strictEqual(sp({ shiftWarn: 'on' }).colors(t, { rpm: 5800, oil: 90 }).color[0], '#ff0000');
    assert.notStrictEqual(sp({ shiftWarn: 'on' }).colors(t, { rpm: 5000, oil: 90 }).color[0], '#ff0000');
    assert.strictEqual(sp({ shiftWarn: 'on' }).colors(t, { rpm: 4600, oil: 30 }).color[0], '#ff0000');
    assert.notStrictEqual(sp({}).colors(t, { rpm: 5800, oil: 90 }).color[0], '#ff0000');
});
check('temperature gauges as the car\'s (C-H, the default): the needle in the middle once warm, towards H above it', () => {
    assert.strictEqual(C.chFrac('coolant', 20), 0);
    assert(Math.abs(C.chFrac('coolant', 90) - 0.5) < 0.03);
    assert(Math.abs(C.chFrac('oil', 100) - 0.5) < 0.03);
    assert(C.chFrac('oil', 130) > C.CH_RED - 0.1 && C.chFrac('oil', 145) === 1);
    assert(C.chFrac('coolant', 60) < 0.45);
    assert.strictEqual(C.chOf(o(), 'oil'), 'oil');
    assert.strictEqual(C.chOf(o({ tempGauge: 'scale' }), 'oil'), null);
    assert.strictEqual(C.chOf(o(), 'boost'), null);
    const L = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
    ['analog_sport', 'digital_round', 'retro', 'classic'].forEach((id) => {
        const keys = L.byId(id).pieces(o({ bottomStrip: 'stock', centre: 'info', gaugeSpeed: 'coolant', gaugeRpm: 'oil' })).map((p) => p.key);
        assert(keys.some((k) => /ChH$|Sub2$/.test(k)), id + ': ' + keys.join(','));
    });
});
check('the throttle (the valve, as Live Data: 4600 / 5858, OBD 11) apart from the pedal; both read twice a round', () => {
    const { DME_KEYS, FAST_KEYS } = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'data.js'));
    assert(DME_KEYS.indexOf('throttle') >= 0 && FAST_KEYS.indexOf('pedal') >= 0 && FAST_KEYS.indexOf('throttle') >= 0);
    ['akakingj_cluster_layouts', 'akakingj_cluster_centre'].forEach((a) => {
        const c = require(path.join(ROOT, 'apps', a, 'app.json')).config.dme.throttle;
        assert.deepStrictEqual(c.map((x) => x.did || 'OBD ' + x.obd), ['4600', '5858', 'OBD 11'], a);
        assert(Math.abs(12800 * c[0].factor - 100) < 0.01);
    });
    const L = require(path.join(ROOT, 'apps', 'akakingj_cluster_layouts', 'layouts.js'));
    const low = (x) => L.byId('classic').pieces(o(Object.assign({ bottomStrip: 'stock', centre: 'info' }, x))).find((p) => p.key === 'socTxt');
    assert.strictEqual(low({}).text({ coolant: 90 }), 'COOLANT 90°');
    assert.strictEqual(low({ infoLow: 'throttle' }).text({ throttle: 40 }), 'THROTTLE 40%');
    assert.strictEqual(low({ infoLow: 'boost' }).text({ boostActual: 1, engineOn: true }), 'BOOST 14.5 psi');
});
check('settings in sections: the top lists Show, Layout, Colours and the sections; a section opens, Back returns', () => {
    const { listSheet } = require(path.join(ROOT, 'kit', 'runtime', 'sheet.js'));
    const vals = {}; SPEC.settings.forEach((x) => { vals[x.key] = x.default; });
    const st = { schema: SPEC.settings, get: (k) => vals[k], set: (k, v) => { vals[k] = v; }, display: (k) => String(vals[k]), cycle() {} };
    const sh = listSheet(st, null, {});
    const top = sh.entries().map((e) => e.key || '[' + e.section + ']');
    assert.deepStrictEqual(top, ['show', 'layout', 'look', '[Display]', '[Readouts and gauges]', '[Red zone and shift]', '[Units and clock]', '[Car]']);
    sh.focus = 4; sh.choose();
    assert.strictEqual(sh.sec, 'Readouts and gauges');
    assert.strictEqual(sh.entries()[0].key, 'infoA');
    sh.focus = 0; sh.choose(); assert.strictEqual(sh.open.key, 'infoA');
    sh.sub = sh.open.options.findIndex((x) => x[0] === 'boost'); sh.choose();
    assert.strictEqual(vals.infoA, 'boost'); assert.strictEqual(sh.sec, 'Readouts and gauges');
    assert.strictEqual(sh.back(), null); assert.strictEqual(sh.sec, null); assert.strictEqual(sh.focus, 4);
    assert.strictEqual(sh.back(), 'close');
});
console.log(n + ' passed');
