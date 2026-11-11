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
const d = { iat: 31, gearbox: 78, oil: 98, coolant: 90, boostActual: 1.0, torque: 300, rpm: 5000, enginePower: 300 * 5000 / 9549.3, pedal: 85.4, timing: 6, engineOn: true };
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
    assert.strictEqual(t('throttle'), 'THR 85%');
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
    assert.strictEqual(C.focus.power(o({ infoMain: 'throttle' }))(d), '85%');
    assert.strictEqual(C.focus.power(o({ infoMain: 'iat' }))(d), '31°');
    assert.strictEqual(C.focus.power(o({ infoMain: 'boost' }))(Object.assign({}, d, { engineOn: false })), 'OFF');
    assert.strictEqual(C.focus.power(o({ infoMain: 'power' }))({}), '--');
    assert(Math.abs(C.focus.mainFrac(o({ infoMain: 'throttle' }))(d) - 0.854) < 1e-9);
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
    assert(C.focus.needs(o({ infoMain: 'throttle' })).indexOf('pedal') >= 0);
    assert(C.focus.needs(o({ gaugeRpm: 'throttle' })).indexOf('pedal') >= 0);
    assert(C.focus.needs(o()).indexOf('pedal') < 0);
});
console.log(n + ' passed');
