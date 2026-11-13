'use strict';
/**
 * test_korean.js - the Korean build (the Store builds the apps with --language ko, mgu-repo.json): every name on the
 * iDrive screens has its Korean (labels, options, sections, titles, buttons), every Korean letter is in the Korean
 * font, the Store's build and the package's version stay plain (no -ko suffix the Store wouldn't find).
 *   node tools/test_korean.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const KO = JSON.parse(fs.readFileSync(path.join(ROOT, 'kit', 'runtime', 'locales', 'ko.json'), 'utf8'));
const APPS = ['akakingj_cluster_layouts', 'akakingj_cluster_centre', 'akakingj_cluster_info'];

let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('ok   ' + name); };

check('the Store builds in Korean', () => {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'mgu-repo.json'), 'utf8'));
    assert.deepStrictEqual(m.apps.build.args, ['--language', 'ko', '{id}']);
    assert.strictEqual(m.apps.build.output, 'dist/{id}@{version}.tgz');
});

check('every name on the iDrive screens has its Korean (exact, as the HMI looks it up)', () => {
    const miss = [];
    const want = (s, where) => { if (typeof s === 'string' && /[A-Za-z]{2}/.test(s) && !Object.prototype.hasOwnProperty.call(KO, s)) miss.push(where + ': ' + s); };
    APPS.forEach((a) => {
        const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', a, 'app.json'), 'utf8'));
        want(spec.title, a + ' title');
        (spec.screens || []).forEach((sc) => { want(sc.title, a + ' screen'); (sc.buttons || []).forEach((b) => want(b[1], a + ' button')); });
        (spec.settings || []).forEach((s) => {
            want(s.label, a + ' ' + s.key); want(s.section, a + ' section');
            (s.options || []).forEach((o) => want(o[1], a + ' ' + s.key + ' option'));
        });
    });
    assert.deepStrictEqual(miss, [], 'no Korean for:\n' + miss.join('\n'));
});

check('every Korean letter is in the Korean font', () => {
    const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'kit', 'localization', 'fonts', 'korean.json'), 'utf8'));
    const miss = new Set();
    atlas.sizes.forEach((s) => Object.keys(KO).forEach((k) => { for (const ch of KO[k]) if (!/[\n\r\t]/.test(ch) && !s.glyphs[ch.codePointAt(0)]) miss.add(ch); }));
    assert.deepStrictEqual([...miss], []);
});

check('Korean keeps the plain version; ko-KR is Korean', () => {
    const out = execFileSync('python3', ['-c', [
        'import sys; sys.path.insert(0, "kit/tools")',
        'from localize import package_version, normalize_language, localize_spec',
        'print(package_version("1.2.3", "ko"), normalize_language("ko-KR"), normalize_language("ko_KR"))',
        'print(localize_spec({"title": "AK Cluster Centre", "version": "0.9.5", "settings": [{"key": "a", "label": "Fuel tank size", "section": "Car"}]}, "ko")["settings"][0])',
    ].join('\n')], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
    assert.strictEqual(out[0], '1.2.3 ko ko');
    assert(/연료 탱크 크기/.test(out[1]) && /차량/.test(out[1]), out[1]);
});

console.log(ok + ' passed');
