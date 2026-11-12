'use strict';
/**
 * test_node8.js - every other test (tools/ and kit/tools/), and the runtime and fit checks, with tools/node8_guard.js
 * preloaded: what the apps call must be there on the head unit's Node 8.16.2.
 *   node tools/test_node8.js
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(__dirname, 'node8_guard.js');
const list = [].concat(
    fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /^test_.*\.js$/.test(f) && f !== 'test_node8.js').map((f) => path.join('tools', f)),
    fs.readdirSync(path.join(ROOT, 'kit', 'tools')).filter((f) => /^test_.*\.js$/.test(f)).map((f) => path.join('kit', 'tools', f)),
    ['tools/check_runtime.js', 'tools/check_fit.js']);
let failed = 0;
list.forEach((t) => {
    const r = spawnSync(process.execPath, ['-r', GUARD, t], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
    const out = (r.stdout || '') + (r.stderr || ''), hit = out.split('\n').filter((l) => /^NODE8:/.test(l));
    if (r.status !== 0 || hit.length) { failed++; console.log('FAIL ' + t + '\n  ' + (hit[0] || out.trim().split('\n').slice(-3).join('\n  '))); } else console.log('ok   ' + t);
});
console.log(failed ? failed + ' failed on Node 8\'s API' : 'all ' + list.length + ' pass with Node 8\'s API');
process.exit(failed ? 1 : 0);
