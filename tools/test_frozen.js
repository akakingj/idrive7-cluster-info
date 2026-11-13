'use strict';
/**
 * test_frozen.js - readings that stopped coming in while the car runs (engine.js frozen()): the layout and Cluster
 * Centre's pages hide, the stock cluster back, rather than leave the last speed up; parked with the engine off is not
 * frozen; both apps use it.
 *   node tools/test_frozen.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('./scene');
const { frozen, FROZEN_MS } = require(path.join(__dirname, '..', 'shared', 'engine'));

const now = 1e7;
assert.strictEqual(FROZEN_MS, 3000);
assert.strictEqual(frozen({ rpm: 2200, speed: 90 }, now - 500, now), false, 'samples coming: live');
assert.strictEqual(frozen({ rpm: 2200, speed: 90 }, now - 4000, now), true, 'driving, nothing for 4 s: frozen');
assert.strictEqual(frozen({ rpm: 0, speed: 60 }, now - 4000, now), true, 'rolling, engine off (a hybrid): frozen');
assert.strictEqual(frozen({ rpm: 800, speed: 0 }, now - 4000, now), true, 'idling: rpm keeps coming, so frozen');
assert.strictEqual(frozen({ rpm: 0, speed: 0 }, now - 600000, now), false, 'parked, engine off: not frozen');
assert.strictEqual(frozen({ rpm: 2200, speed: 90, demo: true }, now - 9000, now), false, 'demo');
assert.strictEqual(frozen({ rpm: 2200, speed: 90 }, 0, now), false, 'no sample yet: the services decide');
assert.strictEqual(frozen({}, now - 9000, now), false, 'no readings');
['akakingj_cluster_layouts', 'akakingj_cluster_centre'].forEach((a) => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'apps', a, 'main.js'), 'utf8');
    assert(/frozen\(/.test(src) && /onSample\(\(\) => \{ lastSample = Date\.now\(\); \}\)/.test(src), a + ' checks it');
});
console.log('9 passed');
