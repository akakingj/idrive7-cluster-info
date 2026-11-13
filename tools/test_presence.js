'use strict';
// presence.js: under a strict umask (077) the folder and file are still readable by the other app (another user):
// the folder 0755, the file 0644; and the other app sees it.
//   node tools/test_presence.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.umask(0o077);
const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'presence-')), 'cluster-layouts');
process.env.CLUSTER_PRESENCE_DIR = dir;
const P = require(path.join(__dirname, '..', 'shared', 'presence.js'));
const mode = (f) => fs.statSync(f).mode & 0o777;

P.mark('layouts', { centre: 'map' });
assert.strictEqual(mode(dir), 0o755, 'the folder ' + mode(dir).toString(8));
assert.strictEqual(mode(path.join(dir, 'layouts.json')), 0o644, 'the file');
assert.strictEqual(P.active('layouts'), true);
assert.strictEqual(P.info('layouts').centre, 'map');
assert.strictEqual(P.active('centre'), false, 'one that never said so');
// a folder left 0700 by an older build: opened up on the first mark
fs.chmodSync(dir, 0o700);
delete require.cache[require.resolve(path.join(__dirname, '..', 'shared', 'presence.js'))];
require(path.join(__dirname, '..', 'shared', 'presence.js')).mark('layouts', {});
assert.strictEqual(mode(dir), 0o755, 'an old folder opened up');
// a file that doesn't read whole (mid-write): the last reading stands, the layout still showing
const P3 = require(path.join(__dirname, '..', 'shared', 'presence.js'));
P3.mark('layouts', { centre: 'map' }); assert.strictEqual(P3.active('layouts'), true);
fs.writeFileSync(path.join(dir, 'layouts.json'), '{"centre": "ma');
const until = Date.now() + 700; while (Date.now() < until) { /* past the half-second cache */ }
assert.strictEqual(P3.active('layouts'), true, 'half a file: still showing');
assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => /\.tmp$/.test(n)), [], 'no temp file left');
fs.unlinkSync(path.join(dir, 'layouts.json'));
const until2 = Date.now() + 700; while (Date.now() < until2) { /* again */ }
assert.strictEqual(P3.active('layouts'), false, 'gone: not showing');
['akakingj_cluster_centre', 'akakingj_cluster_layouts'].forEach((a) => assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'apps', a, 'presence.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'shared', 'presence.js'), 'utf8'), a + ': the shared copy'));
console.log('9 passed');
