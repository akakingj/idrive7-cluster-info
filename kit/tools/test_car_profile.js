'use strict';
/**
 * test_car_profile.js - the cluster apps' settings following the Car profile (akakingj/idrive7-apps, apps/car_profile:
 * /dev/shm/car-profile.json), with their real app.json "profile" settings: kit/runtime/mgu.js Settings and
 * kit/runtime/sheet.js, on the PC.
 *
 *   node kit/tools/test_car_profile.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carprofile-'));
const FILE = path.join(dir, 'car-profile.json');
process.env.MGU_CAR_PROFILE = FILE;

// the real Settings class without the SDK (as hu-stub.js cuts it)
const src = fs.readFileSync(path.join(ROOT, 'kit', 'runtime', 'mgu.js'), 'utf8').replace(/\r\n/g, '\n');
const cls = src.match(/class Settings[\s\S]*?\n}\n/)[0];
const quiet = { info() {}, warn() {}, error() {} };
let n = 0;
const schemaOf = (app) => JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'akakingj_cluster_' + app, 'app.json'), 'utf8')).settings;
const settingsIn = (app, saved) => {
    const dd = path.join(dir, 'app' + (n++));
    fs.mkdirSync(dd);
    if (saved) fs.writeFileSync(path.join(dd, 'settings.json'), JSON.stringify(saved));
    const S = new Function('fs', 'path', 'DATA_DIR', 'log', cls + '\nreturn Settings;')(fs, path, dd, quiet);
    return new S(schemaOf(app));
};
// the file as the Car profile app writes it (profile.js publish); its mtime moved on at each write (the poll looks at it)
let tick = Date.now() / 1000 - 1000;
const writeProfile = (values) => {
    fs.writeFileSync(FILE, JSON.stringify({ v: 1, app: 'car_profile', version: '1.0.0', values }, null, 1));
    tick += 5; fs.utimesSync(FILE, tick, tick);
};
const clear = () => { try { fs.unlinkSync(FILE); } catch (e) { /* none */ } };

// the Car profile's names (profile.js KEYS) and the values it can set
const PROFILE_VALUES = {
    engine: ['auto', 'diesel', 'petrol'], redline: [0, 4000, 6000, 7000, 9000], rpmScale: [0, 5000, 7000, 10000],
    coldLimit: [0, 2000, 4500, 5500], lightMode: ['shift', 'rev'], lightStart: [2000, 4000, 6000], warmOil: [60, 80, 100],
    warmCoolant: [60, 90], speedUnit: ['kmh', 'mph'], distUnit: ['km', 'mi'], tempUnit: ['c', 'f'],
    pressUnit: ['bar', 'psi', 'kpa'], fuelUnit: ['l100', 'kml', 'mpguk', 'mpgus'], torqueUnit: ['nm', 'lbft', 'kgm'],
    powerUnit: ['hp', 'ps', 'kw'],
};
// what each app follows (app.json "profile")
const FOLLOWS = {
    layouts: { redline: 'redline', rpmMax: 'rpmScale', coldLimit: 'coldLimit', warmOil: 'warmOil', speedUnit: 'speedUnit', tempUnit: 'tempUnit', torqueUnit: 'torqueUnit', pressUnit: 'pressUnit', powerUnit: 'powerUnit' },
    centre: { redline: 'redline', coldLimit: 'coldLimit', warmTarget: 'warmOil', shiftFrom: 'lightStart', speedUnit: 'speedUnit', tempUnit: 'tempUnit', torqueUnit: 'torqueUnit', pressUnit: 'pressUnit', powerUnit: 'powerUnit' },
    info: { tempUnit: 'tempUnit', torqueUnit: 'torqueUnit', pressUnit: 'pressUnit' },
};
const MINE = { speedUnit: 'mph', tempUnit: 'f', torqueUnit: 'nm', pressUnit: 'bar', powerUnit: 'kw', redline: 7000, rpmMax: 8000, coldLimit: 3500, warmOil: 90, warmTarget: 90, shiftFrom: 3000 };

const cases = {
    'each app follows the names it says, a known name of the Car profile each'() {
        Object.keys(FOLLOWS).forEach((app) => {
            const got = {};
            schemaOf(app).forEach((s) => { if (s.profile) got[s.key] = s.profile; });
            assert.deepStrictEqual(got, FOLLOWS[app], app);
            Object.keys(got).forEach((k) => assert(PROFILE_VALUES[got[k]], app + ' ' + k + ': ' + got[k] + ' is no Car profile name'));
        });
    },
    'no profile: each app its own values'() {
        clear();
        Object.keys(FOLLOWS).forEach((app) => {
            const s = settingsIn(app, MINE);
            Object.keys(FOLLOWS[app]).forEach((k) => { assert.strictEqual(s.get(k), MINE[k], app + ' ' + k); assert.strictEqual(s.held(k), false); });
        });
    },
    'a profile: its values over the app\'s, which are kept'() {
        clear();
        writeProfile({ redline: 6000, rpmScale: 7000, coldLimit: 4500, warmOil: 80, lightStart: 4000, speedUnit: 'kmh', tempUnit: 'c', pressUnit: 'psi', torqueUnit: 'kgm', powerUnit: 'hp', fuelUnit: 'l100', distUnit: 'km' });
        const L = settingsIn('layouts', MINE);
        assert.deepStrictEqual(['redline', 'rpmMax', 'coldLimit', 'warmOil', 'speedUnit', 'tempUnit', 'pressUnit', 'torqueUnit', 'powerUnit'].map((k) => L.get(k)), [6000, 7000, 4500, 80, 'kmh', 'c', 'psi', 'kgm', 'hp']);
        assert.strictEqual(L.values.redline, 7000, 'the app\'s own value kept');
        assert.strictEqual(L.display('redline'), '6000 rpm');
        assert.strictEqual(L.display('speedUnit'), schemaOf('layouts').find((s) => s.key === 'speedUnit').options.find((o) => o[0] === 'kmh')[1]);
        const Ce = settingsIn('centre', MINE);
        assert.strictEqual(Ce.get('warmTarget'), 80, 'Oil warm at <- warmOil');
        assert.strictEqual(Ce.get('shiftFrom'), 4000, 'Shift light: starts at <- Rev bar from');
        assert.strictEqual(Ce.get('shiftAt'), 5700, 'the flash point is the app\'s (no Car profile name)');
        const I = settingsIn('info', MINE);
        assert.deepStrictEqual([I.get('tempUnit'), I.get('torqueUnit'), I.get('pressUnit')], ['c', 'kgm', 'psi']);
    },
    'the profile\'s Auto (0) and values a setting can\'t take: the app\'s own'() {
        clear();
        writeProfile({ redline: 0, rpmScale: 0, coldLimit: 0, speedUnit: 'kph', tempUnit: 'k', torqueUnit: 7, warmOil: -1 });
        const L = settingsIn('layouts', MINE);
        ['redline', 'rpmMax', 'coldLimit', 'warmOil', 'speedUnit', 'tempUnit', 'torqueUnit'].forEach((k) => { assert.strictEqual(L.get(k), MINE[k], k); assert.strictEqual(L.held(k), false, k); });
    },
    'every value the Car profile can set: taken or left, never a value the setting doesn\'t have'() {
        Object.keys(FOLLOWS).forEach((app) => {
            Object.keys(FOLLOWS[app]).forEach((key) => {
                const name = FOLLOWS[app][key], schema = schemaOf(app).find((s) => s.key === key);
                PROFILE_VALUES[name].forEach((v) => {
                    clear(); writeProfile({ [name]: v });
                    const s = settingsIn(app, MINE), got = s.get(key);
                    if (schema.type === 'choice') assert(schema.options.some((o) => o[0] === got), app + ' ' + key + ' = ' + got);
                    else assert(typeof got === 'number' && got > 0, app + ' ' + key + ' = ' + got);
                    assert.strictEqual(s.held(key), got === v, app + ' ' + key + ' ' + v);
                });
            });
        });
    },
    'held: not changed here (cycle, the drawn list), the own value as it was'() {
        clear();
        writeProfile({ speedUnit: 'kmh', redline: 6000 });
        const s = settingsIn('layouts', MINE);
        s.cycle('speedUnit'); s.cycle('redline');
        assert.strictEqual(s.values.speedUnit, 'mph'); assert.strictEqual(s.values.redline, 7000);
        const { listSheet } = require(path.join(ROOT, 'kit', 'runtime', 'sheet.js'));
        const sh = listSheet(s, { version: '0' });
        // into the redline's section, then the redline's row: nothing opens
        const top = sh.entries(), sec = s.item('redline').section;
        if (sec) { sh.focus = top.findIndex((e) => e.section === sec); sh.choose(); }
        sh.focus = sh.entries().findIndex((e) => e.key === 'redline');
        assert(sh.focus >= 0);
        sh.choose();
        assert.strictEqual(sh.open, null, 'no list of values for a held setting');
        assert.strictEqual(s.values.redline, 7000);
        // one the profile leaves: its list opens
        sh.focus = sh.entries().findIndex((e) => e.key === 'rpmMax');
        sh.choose();
        assert(sh.open && sh.open.key === 'rpmMax');
    },
    'a change of the profile: the listeners told, as a change of the setting; gone: the own values back'() {
        clear();
        const s = settingsIn('layouts', MINE), heard = [];
        s.onChange((k, v) => heard.push(k + '=' + v));
        writeProfile({ redline: 6000, speedUnit: 'mph' });     // (mph: the own value already)
        s._pollProfile();
        assert.deepStrictEqual(heard, ['redline=6000']);
        s._pollProfile();
        assert.deepStrictEqual(heard, ['redline=6000'], 'unchanged file: nothing');
        clear();
        s._pollProfile();
        assert.deepStrictEqual(heard, ['redline=6000', 'redline=7000']);
        assert.strictEqual(s.held('redline'), false);
    },
    'a file in the making or another format: the last good values, or none'() {
        clear();
        writeProfile({ redline: 6000 });
        const s = settingsIn('layouts', MINE);
        fs.writeFileSync(FILE, '{"v": 1, "values": {"redl'); tick += 5; fs.utimesSync(FILE, tick, tick);
        s._pollProfile();
        assert.strictEqual(s.get('redline'), 6000, 'half a file: the last values kept');
        fs.writeFileSync(FILE, JSON.stringify({ v: 2, values: { redline: 5000 } })); tick += 5; fs.utimesSync(FILE, tick, tick);
        s._pollProfile();
        assert.strictEqual(s.get('redline'), 7000, 'another version: not followed');
    },
};

let failed = 0;
Object.keys(cases).forEach((name) => {
    try { cases[name](); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack || e)); }
});
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* tmp */ }
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
