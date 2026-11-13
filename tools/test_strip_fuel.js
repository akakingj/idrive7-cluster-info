'use strict';
// The car's own strip's fuel bar: left out where the layout shows the fuel itself (Arc tach's right dial, Twin
// cowl's right gauge), back when Small gauge in the tach / speedometer puts another reading there.
//   node tools/test_strip_fuel.js
const assert = require('assert');
const path = require('path');
const { makeScene } = require('./scene');
const SPEC = require(path.join(__dirname, '..', 'apps', 'akakingj_cluster_layouts', 'app.json'));
const defaults = {};
SPEC.settings.forEach((s) => { defaults[s.key] = s.default; });
const keys = (layout, set) => {
    const s = Object.assign({}, defaults, set);
    const o = Object.assign({}, s, { redline: Number(s.redline), rpmMax: Number(s.rpmMax), cluster: 'standard', bottomStrip: 'stock' });
    const sc = makeScene({ layout, options: o, data: {}, log: { info() {}, warn() {}, error() {} } });
    const k = sc.engine._pieces().map((p) => p.key);
    try { sc.engine.stop(); } catch (e) { /* gone */ }
    return k;
};
let n = 0;
[['arc_tach', 'gaugeRpm'], ['twin_cowl', 'gaugeSpeed']].forEach(([id, setting]) => {
    assert(keys(id, {}).indexOf('stripFuel') < 0, id + ': its own fuel gauge, no strip bar'); n++;
    assert(keys(id, { [setting]: 'fuel' }).indexOf('stripFuel') < 0, id + ': the fuel picked there, no strip bar'); n++;
    assert(keys(id, { [setting]: 'boost' }).indexOf('stripFuel') >= 0, id + ': another reading there, the strip bar back'); n++;
});
assert(keys('analog_sport', {}).indexOf('stripFuel') >= 0, 'a layout without its own: the strip bar'); n++;
console.log(n + ' passed');
