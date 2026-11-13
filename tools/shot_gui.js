'use strict';
// shot_gui.js <id> <outdir>: the app's own screens on the stubbed head unit, as PNGs (MAIN, Signals pages, Logs, Settings)
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const id = process.argv[2], out = process.argv[3];
process.env.CLUSTER_INFO_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
process.env.CLUSTER_PRESENCE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
// (SHOT_LANG=ko: the Korean build, as the Store builds it)
execFileSync('python3', [path.join(ROOT, 'kit', 'tools', 'build.py')].concat(process.env.SHOT_LANG ? ['--language', process.env.SHOT_LANG] : [], [id]), { cwd: ROOT, stdio: 'pipe' });
const { headUnit } = require(path.join(ROOT, 'kit', 'tools', 'hu-stub.js'));
let tag = 'main', n = 0;
const save = (name, cv) => { try { const png = Buffer.isBuffer(cv) ? cv : cv.png ? cv.png() : null; if (png) { fs.writeFileSync(path.join(out, id + '_' + (++n) + '_' + tag + '_' + name + '.png'), png); } } catch (e) { console.error('save', e.message); } };
const quiet = { info() {}, warn() {}, error: (m) => console.error(m), debug() {} };
(async () => {
    const hu = headUnit(path.join(ROOT, 'dist', id), { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), id + '-')), fresh: true, log: quiet, image: save });
    const L = console.log; console.log = () => {};
    await hu.start(); await new Promise((r) => setTimeout(r, 1500));
    if (hu.loopFn) await hu.loopFn('MAIN');
    for (const [btn, times] of [['BTN_SIGNALS', 4], ['BTN_LOGS', 2], ['BTN_NEXT', 3], ['BTN_SETTINGS', 1], ['BTN_SHOW', 1]]) {
        for (let i = 0; i < times && hu.handlers[btn]; i++) { tag = btn.toLowerCase() + (i + 1); await hu.handlers[btn](); await new Promise((r) => setTimeout(r, 300)); if (hu.loopFn) await hu.loopFn('MAIN'); }
    }
    console.log = L; console.log(id + ': ' + n + ' images; buttons ' + Object.keys(hu.handlers).join(','));
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
