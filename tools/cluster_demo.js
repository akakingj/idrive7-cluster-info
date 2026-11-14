'use strict';
/**
 * cluster_demo.js - Cluster Layouts, Cluster Centre and Cluster Info on your computer, live.
 *
 * Each app's own code draws as it does on the car: Layouts' and Centre's engine.js drive a stand-in for the
 * cluster renderer (tools/scene.js) and a browser page draws what they would send with WebGL, the GLSL the
 * KOMBI runs; Cluster Info's panel and HUD arrows are drawn by its own overlay.js on the kit's canvas. The
 * settings are each app's app.json; the car's values are sliders, or an automatic drive.
 *
 *   node tools/cluster_demo.js [--port 8765] [--no-open] [--single]      (Windows: cluster_demo.bat)
 *
 * Needs only Node (no packages, no head unit). Opens two windows: the settings (?view=controls) and the
 * screens (?view=display), kept in step through the browser; --single: one window with both.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { FakeClient } = require('./scene');   // (also points the apps' './kit/' at kit/runtime)

const DEMO_VERSION = '2.2.0';
const ROOT = path.join(__dirname, '..');
const APPS = { layouts: path.join(ROOT, 'apps', 'akakingj_cluster_layouts'), centre: path.join(ROOT, 'apps', 'akakingj_cluster_centre'), info: path.join(ROOT, 'apps', 'akakingj_cluster_info') };
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = Number(argOf('--port', process.env.PORT || 8765));
const OPEN = argv.indexOf('--no-open') < 0;
const SINGLE = argv.indexOf('--single') >= 0;
const req = (app, mod) => require(path.join(APPS[app], mod));
const tryReq = (app, mod) => { try { return req(app, mod); } catch (e) { return null; } };
const manifest = (app) => JSON.parse(fs.readFileSync(path.join(APPS[app], 'app.json'), 'utf8'));
const nullLog = { info() {}, warn() {}, error(m) { console.error(m); } };

/* the settings each app offers here: its own, less those that only matter on the car */
const SKIP = {
    layouts: ['show', 'demo', 'sweep', 'eFull', 'batteryReads'],
    centre: ['show', 'demo', 'eFull', 'kwFast'],
    info: ['demo', 'renderer', 'layout'],
};
function settingsOf(app) {
    const m = manifest(app);
    return { version: m.version, title: m.title || m.id, list: (m.settings || []).filter((s) => SKIP[app].indexOf(s.key) < 0 && (s.type === 'choice' || s.type === 'number')) };
}
const withDefaults = (app, set) => { const o = {}; settingsOf(app).list.forEach((s) => { o[s.key] = s.default; }); return Object.assign(o, set || {}); };
const num = (set, k, d) => { const v = Number(set[k]); return isFinite(v) ? v : d; };
const vehicleOf = (set) => (set.vehicle === 'phev' ? 'phev' : 'ice');     // (Auto: a petrol car here, unless chosen)

/* ---------- scenes: shader sources sent to the page once each, assets when they change ---------- */
const fsIds = new Map(); const fsList = [];
function sceneOf(client, w, h) {
    const ls = Array.from(client.layers.values());
    const order = { ambient: 0, content: 1, overlay: 2, alert: 3 };
    const quads = ls.filter((l) => l.kind === 'effect' && l.opts.visible !== false)
        .sort((a, b) => (order[a.opts.klass] - order[b.opts.klass]) || ((a.opts.z || 0) - (b.opts.z || 0)) || (a.ref - b.ref))
        .map((l) => {
            let id = fsIds.get(l.opts.fs);
            if (id === undefined) { id = fsList.length; fsList.push(l.opts.fs); fsIds.set(l.opts.fs, id); }
            return [l.opts.x, l.opts.y, l.opts.w, l.opts.h, id, l.uniforms, l.binds];
        });
    const assetLs = ls.filter((l) => l.kind === 'asset');
    const sig = assetLs.map((l) => l.ref + ':' + l.opts.w + 'x' + l.opts.h + ':' + (l.pixels ? l.pixels.length : 0)).join(',');
    return { w, h, quads, sig, assets: () => {
        const a = {};
        assetLs.forEach((l) => { a[l.ref] = { w: l.opts.w, h: l.opts.h, rgba: l.opts.format === 'rgba8', px: l.pixels ? l.pixels.toString('base64') : '' }; });
        return a;
    } };
}

/* ---------- Cluster Layouts ---------- */
function startLayouts(set) {
    const { startCluster } = req('layouts', 'engine');
    const { byId } = req('layouts', 'layouts');
    const { lookNow } = req('layouts', 'themes');
    const clock = req('layouts', 'clock');
    const dap = tryReq('layouts', 'dap');
    clock.setZone(set.timeZone); clock.setTwelve(set.clock !== '24');
    const { layoutFor } = req('layouts', 'layouts');
    let layout = byId(set.layout);
    const BLACK = { bg: '#000000', bgTop: '#000000', bgBottom: '#000000', face0: '#000000', face1: '#000000' };
    const o = {
        speedUnit: set.speedUnit, tempUnit: set.tempUnit, torqueUnit: set.torqueUnit, pressUnit: set.pressUnit,
        centre: set.centre === 'pages' ? 'map' : set.centre, redline: num(set, 'redline', 7000), rpmMax: num(set, 'rpmMax', 8000),
        boxClear: set.boxClear === 'on', cluster: set.cluster === 'm' ? 'm' : 'standard',
        bottomStrip: set.bottomStrip === 'layout' ? 'layout' : 'stock', boxBezel: set.boxBezel === 'on', vehicle: vehicleOf(set),
        tankLitres: num(set, 'tankLitres', 69),
        powerUnit: set.powerUnit, infoA: set.infoA, infoB: set.infoB, infoMain: set.infoMain, infoLow: set.infoLow, gaugeSpeed: set.gaugeSpeed, gaugeRpm: set.gaugeRpm, tempGauge: set.tempGauge, tempTone: set.tempTone, shiftWarn: set.shiftWarn, amberRpm: set.amberRpm, shiftBefore: set.shiftBefore, coldGuard: set.coldGuard, coldLimit: set.coldLimit, warmOil: set.warmOil,
    };
    const st = { data: {}, client: new FakeClient() };
    st.look = () => lookNow(set.look, st.data);
    st.engine = startCluster({
        client: st.client, log: nullLog, layout: () => layout, font: () => layout.font || 'bold', settleMs: 0, target: 'panel',
        options: () => o, theme: () => Object.assign({}, layout.palette(st.look()), set.background === 'tinted' ? {} : BLACK),
        sweep: () => false, data: () => st.data, live: () => true, enabled: () => true,
    });
    st.lastLook = st.look();
    st.frame = (data, extra) => {
        st.data = Object.assign({}, data, { dap: extra.dap && dap && dap.DEMO ? dap.DEMO : null, vehicle: o.vehicle });
        // (the layout for the drive mode: Layout in Sport / in ECO PRO)
        const want = byId(layoutFor((k) => set[k], st.data));
        if (want !== layout) { layout = want; st.engine.rebuild(); }
        const look = st.look();
        if (look !== st.lastLook) { st.lastLook = look; st.engine.recolour(); }
        st.engine._tick();
        return { scene: sceneOf(st.client, 1920, 720), look, map: o.centre === 'map', strip: o.bottomStrip === 'stock',
            mBoxes: o.cluster === 'm' ? req('layouts', 'layout_common').M_BOXES : [] };
    };
    st.stop = () => st.engine.stop();
    return st;
}

/* ---------- Cluster Centre ---------- */
const CENTRE_PAGES = ['temps', 'fuel', 'warmup', 'cooldown', 'edrive', 'engine', 'steering', 'timer', 'custom1', 'custom2'];
function startCentre(set) {
    const { startCluster } = req('centre', 'engine');
    const { pieces, palette } = req('centre', 'pages');
    const { WarmUp, CoolDown, PerfTimer } = req('centre', 'features');
    const clock = req('centre', 'clock');
    clock.setZone(set.timeZone); clock.setTwelve(set.clock !== '24');
    const vehicle = vehicleOf(set);
    const enabled = () => CENTRE_PAGES.filter((id) => set['page_' + id] === 'on' && !(id === 'edrive' && vehicle === 'ice'));
    const o = {
        look: set.look, fit: set.fit, pages: enabled(), style: set.style, accent: set.accent, size: set.size,
        units: { temp: set.tempUnit, press: set.pressUnit, speed: set.speedUnit, torque: set.torqueUnit, power: set.powerUnit },
        warn: { oilHigh: num(set, 'oilHigh'), coolantHigh: num(set, 'coolantHigh'), iatHigh: num(set, 'iatHigh'), gearboxHigh: num(set, 'gearboxHigh'), battTempHigh: num(set, 'battTempHigh'), lpfpLow: num(set, 'lpfpLow') },
        shift: { on: set.shift !== 'off', from: num(set, 'shiftFrom', 4000), at: num(set, 'shiftAt', 6200) },
        badge: set.badge !== 'off', warmTarget: num(set, 'warmTarget', 90), redline: num(set, 'redline', 6500),
        custom: [1, 2].map((i) => ({ style: set['c' + i + 'Style'], slots: [1, 2, 3, 4, 5, 6].slice(0, num(set, 'c' + i + 'Count', 4)).map((s) => set['c' + i + 's' + s]).filter((k) => k && k !== 'none') })),
    };
    const warm = new WarmUp(), cool = new CoolDown(), perf = new PerfTimer();
    Object.assign(warm.o, { target: num(set, 'warmTarget', 90), coldLimit: num(set, 'coldLimit', 3500), redline: num(set, 'redline', 6500) });
    Object.assign(cool.o, { hardRpm: num(set, 'hardRpm', 4500) });
    perf.o.kmh = set.speedUnit === 'kmh';
    const eng = { onMs: 0, driveMs: 0, starts: 0, last: null, was: false };
    const st = { data: {}, client: new FakeClient(), pages: enabled() };
    st.page = st.pages[0] || null; st.pageAt = Date.now();
    const all = () => Object.assign({}, st.data, { warm: warm.state(st.data), cool: cool.state(), perf: perf.state(Date.now()),
        eng: { onMs: eng.onMs, share: eng.driveMs > 60000 ? eng.onMs / eng.driveMs * 100 : null, starts: eng.starts, why: null } });
    st.feed = setInterval(() => {
        const t = Date.now(), d = st.data;
        if (!d || d.speed === undefined) return;
        warm.feed(t, d); cool.feed(t, d); perf.feed(t, d);
        const dt = eng.last === null ? 0 : Math.min(2000, t - eng.last);
        eng.last = t;
        if (d.speed > 1) { eng.driveMs += dt; if (d.engineOn) eng.onMs += dt; }
        if (d.engineOn && !eng.was) eng.starts++;
        eng.was = !!d.engineOn;
    }, 200);
    st.engine = startCluster({
        client: st.client, log: nullLog, target: 'map', contend: true, z: 200, settleMs: 0,
        layout: () => ({ id: 'centre', pieces }), options: () => o, data: all,
        theme: () => palette(set.accent, set.look), font: () => (set.look === 'modern' ? 'bold' : 'light'),
        live: () => true, enabled: () => !!st.page, sweep: () => false, group: st.page,
    });
    const rotateS = Number(set.rotate) || 0;
    st.frame = (data, extra) => {
        st.data = data;
        if (extra.page && extra.page !== st.page && st.pages.indexOf(extra.page) >= 0) { st.page = extra.page; st.pageAt = Date.now(); st.engine.setGroup(st.page); }
        else if (rotateS && st.pages.length > 1 && Date.now() - st.pageAt > rotateS * 1000) {
            st.page = st.pages[(st.pages.indexOf(st.page) + 1) % st.pages.length]; st.pageAt = Date.now(); st.engine.setGroup(st.page);
        }
        st.engine._tick();
        return { scene: sceneOf(st.client, 1088, 480), page: st.page, pages: st.pages, rotate: rotateS };
    };
    st.stop = () => { clearInterval(st.feed); st.engine.stop(); };
    return st;
}

/* ---------- Cluster Info (its own drawing: overlay.js on the kit's canvas) ---------- */
function startInfo(set) {
    const ov = req('info', 'overlay');
    const G = require(path.join(ROOT, 'kit', 'runtime', 'gauges'));
    const { Canvas } = require(path.join(ROOT, 'kit', 'runtime', 'canvas'));
    const themes = require(path.join(ROOT, 'kit', 'runtime', 'themes'));
    const src = fs.readFileSync(path.join(APPS.info, 'overlay.js'), 'utf8');
    const grab = (re, d) => { const m = src.match(re); return m ? m[1] : d; };
    // the overlay's own (a literal read from the source before it was exported)
    const ARROW = ov.ARROW || (() => { try { return Function('return ' + grab(/const ARROW = (\{[^}]*\})/, 'null'))(); } catch (e) { return null; } })() || { w: 30, h: 24, y: 146, left: 349, right: 421 };
    const NIGHT_DIM = Number(grab(/const NIGHT_DIM = ([\d.]+)/, '0.6'));
    const VALUES = { battery: 'BATT', oil: 'OIL', coolant: 'COOL', soc: 'SOC', boost: 'BOOST', rpm: 'RPM', torque: 'NM' };
    const t = Object.assign({}, themes.theme ? themes.theme(set.theme) : {});
    const IDLE_KW = 0.3, GO = '#2fd27a';
    const temp = (c) => (G.isNum(c) ? G.fmt(set.tempUnit === 'f' ? c * 9 / 5 + 32 : c, 0) + '°' : '--');
    const slots = () => [set.slot1, set.slot2, set.slot3].filter((k, i, a) => (k === 'power' || VALUES[k]) && a.indexOf(k) === i);
    const chosen = () => slots().filter((k) => k !== 'power');
    const tempCol = (name, c) => {
        if (!G.isNum(c)) return t.dim;
        if (name === 'battery') return c < 5 ? t.cold : c > 45 ? t.crit : c > 38 ? t.warn : t.text;
        if (name === 'soc') return t.text;
        return c >= 125 ? t.warn : c < 60 ? (t.cold || t.text) : t.text;
    };
    /* what main.js shows: the car's oil, coolant, rpm, torque and boost; eDrive Live's power, charge and battery temperature */
    function valueNow(name, d, x) {
        if (name === 'boost') {
            if (!G.isNum(d.boostActual)) return null;
            const pu = ['psi', 'bar', 'kpa'].indexOf(set.pressUnit) >= 0 ? set.pressUnit : set.tempUnit === 'c' ? 'bar' : 'psi';
            const text = pu === 'bar' ? d.boostActual.toFixed(2) : pu === 'kpa' ? String(Math.round(d.boostActual * 100)) : (d.boostActual * 14.5038).toFixed(1);
            return { text, label: 'BOOST ' + (pu === 'kpa' ? 'kPa' : pu) };
        }
        if (name === 'rpm') return G.isNum(d.rpm) ? { text: String(Math.round(d.rpm / 50) * 50) } : null;
        if (name === 'torque') {
            if (!G.isNum(d.torque)) return null;
            if (set.torqueUnit === 'kgm') return { text: (d.torque / 9.80665).toFixed(1), label: 'KGM' };
            if (set.torqueUnit === 'lbft') return { text: String(Math.round(d.torque * 0.737562)), label: 'LB-FT' };
            return { text: String(Math.round(d.torque)) };
        }
        if (name === 'oil' || name === 'coolant') return G.isNum(d[name]) ? { c: d[name] } : null;
        if (!x.edrive) return null;                       // battery and charge: eDrive Live's
        if (name === 'battery') return G.isNum(d.battTemp) ? { c: d.battTemp } : null;
        if (name === 'soc') return G.isNum(d.soc) ? { text: Math.round(d.soc) + '%' } : null;
        return null;
    }
    function badge(target, d, x) {
        const pct = target === 'hud' ? x.hudPct : 0;
        const r = ov.mapRect(target, pct, 0, 0);
        if (!r) return null;
        const extras = chosen().map((k) => {
            const v = valueNow(k, d, x);
            return { slot: slots().indexOf(k), label: (v && v.label) || VALUES[k], text: v ? (G.isNum(v.c) ? temp(v.c) : v.text || '--') : '--', col: k === 'soc' ? (v ? t.text : t.dim) : tempCol(k, v && v.c) };
        }).filter((e) => e.text !== '--');
        let pw = null;
        if (slots().indexOf('power') >= 0 && x.edrive && G.isNum(d.kw)) {
            const v = d.kw, a = Math.abs(v);
            pw = { kw: v, text: (v < -IDLE_KW ? '-' : '') + G.fmt(a, a < 10 ? 1 : 0), col: v < -IDLE_KW ? GO : a >= 60 ? t.warn : t.text };
            pw.bar = set.bar === 'on' || ((set.bar === 'cluster' || set.bar === undefined) && target !== 'hud');
        }
        if (!pw && !extras.length) return null;
        const underOn = set.underline === 'on' || (set.underline === 'cluster' && target !== 'hud');
        const under = underOn ? { kw: x.edrive && G.isNum(d.kw) ? d.kw : null } : null;
        const b = ov.badgeRect(r, set.place || 'bottom', target, extras.length, pw ? (pw.bar ? true : 'number') : false, underOn);
        const cv = new Canvas(b.w, b.h);
        const pAt = extras.filter((e) => (e.slot || 0) < Math.max(0, slots().indexOf('power'))).length;
        ov.drawBadge(cv, t, pw, 100, 50, extras, pAt, under, b.ph);
        const op = target === 'hud' ? (num(set, 'hudBrightness', 100) / 100) * (set.nightDim !== 'off' && x.night ? NIGHT_DIM : 1) : 1;
        return { x: b.x, y: b.y, w: b.w, h: b.h, opacity: op, px: Buffer.from(cv.d.buffer, cv.d.byteOffset, cv.d.length).toString('base64'), map: r };
    }
    function arrows(x) {
        if (set.turnSignals === 'off' || !x.indicator || x.indicator === 'off') return [];
        const on = Math.floor(Date.now() / 400) % 2 === 0;    // (the flash, roughly the cluster's)
        if (!on) return [];
        const dirs = x.indicator === 'both' ? ['left', 'right'] : [x.indicator];
        const op = (num(set, 'hudBrightness', 100) / 100) * (set.nightDim !== 'off' && x.night ? NIGHT_DIM : 1);
        return dirs.map((dir) => {
            const cv = new Canvas(ARROW.w, ARROW.h);
            ov.drawArrow(cv, dir);
            return { x: dir === 'left' ? ARROW.left : ARROW.right, y: ARROW.y, w: ARROW.w, h: ARROW.h, opacity: op, px: Buffer.from(cv.d.buffer, cv.d.byteOffset, cv.d.length).toString('base64') };
        });
    }
    const st = {};
    st.frame = (d, x) => {
        const show = set.show || 'map';
        // where the panel goes: with the Waze map (on the cluster or the HUD, as Waze on cluster shows it), or always on the HUD
        const onCluster = show === 'map' && x.waze === 'cluster' ? badge('map', d, x) : null;
        const onHud = show === 'hud' || (show === 'map' && x.waze === 'hud') ? badge('hud', d, x) : null;
        return { info: { show, cluster: onCluster, hud: onHud, arrows: arrows(x), hudMap: ov.mapRect('hud', x.hudPct, 0, 0), wazeOn: x.waze } };
    };
    st.stop = () => {};
    return st;
}

/* ---------- the one live app ---------- */
let S = null;
let assetSig = { layouts: '', centre: '' }, assetVer = { layouts: 0, centre: 0 };
const STARTERS = { layouts: startLayouts, centre: startCentre, info: startInfo };
function frame(body) {
    const app = STARTERS[body.app] ? body.app : 'layouts';
    const set = withDefaults(app, body.settings);
    const key = app + JSON.stringify(set);
    if (!S || S.key !== key) {
        if (S) { try { S.stop(); } catch (e) { /* gone */ } }
        S = STARTERS[app](set); S.key = key; S.app = app;
    }
    const data = Object.assign({}, body.data || {});
    const x = body.extra || {};
    const f = S.frame(data, x);
    const out = Object.assign({ app }, f);
    if (f.scene) {
        const sc = f.scene;
        if (sc.sig !== assetSig[app]) { assetSig[app] = sc.sig; assetVer[app]++; }
        out.scene = { w: sc.w, h: sc.h, quads: sc.quads, assetVer: assetVer[app], assets: body.assetVer === assetVer[app] ? null : sc.assets() };
        const known = Number(body.fsKnown) || 0;
        out.fsFrom = known; out.fsNew = fsList.slice(known);
        out.layers = sc.quads.length;
    }
    if (app !== 'layouts') {
        const C = tryReq('layouts', 'layout_common');
        out.mapRect = C && C.MAP ? C.MAP : { x: 416, y: 120, w: 1088, h: 480 };
        out.stripY = C && C.STRIP_Y ? C.STRIP_Y : 646;
    } else {
        out.stripY = req('layouts', 'layout_common').STRIP_Y || 646;
        out.mapRect = req('layouts', 'layout_common').MAP || { x: 416, y: 120, w: 1088, h: 480 };
    }
    return out;
}

/* ---------- the page and the server ---------- */
const PAGE = () => fs.readFileSync(path.join(__dirname, 'cluster_demo.html'), 'utf8');
function meta() {
    const apps = {};
    Object.keys(APPS).forEach((a) => { try { apps[a] = settingsOf(a); } catch (e) { apps[a] = { error: String(e.message) }; } });
    let layouts = [];
    try { layouts = req('layouts', 'layouts').LAYOUTS.map((l) => ({ id: l.id, title: l.title, dap: !!l.dap })); } catch (e) { /* none */ }
    let readings = {};
    try { const R = req('centre', 'readings'); readings = R.READINGS ? Object.fromEntries(Object.keys(R.READINGS).map((k) => [k, R.READINGS[k].short])) : {}; } catch (e) { /* none */ }
    return { demo: DEMO_VERSION, apps, layouts, readings };
}

const server = http.createServer((rq, res) => {
    const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    const pathOnly = String(rq.url || '/').split('?')[0];   // (?view=display / ?view=controls: the same page)
    if (rq.method === 'GET' && (pathOnly === '/' || pathOnly === '/index.html')) return send(200, 'text/html; charset=utf-8', PAGE());
    if (rq.method === 'GET' && rq.url === '/meta') return send(200, 'application/json', JSON.stringify(meta()));
    if (rq.method === 'POST' && rq.url === '/frame') {
        let b = '';
        rq.on('data', (c) => { b += c; if (b.length > 2e6) rq.destroy(); });
        rq.on('end', () => {
            try { send(200, 'application/json', JSON.stringify(frame(JSON.parse(b || '{}')))); } catch (e) { console.error(e); send(500, 'text/plain', String(e && e.stack || e)); }
        });
        return undefined;
    }
    return send(404, 'text/plain', 'not found');
});

function openBrowser(url) {
    const { exec } = require('child_process');
    exec(process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"', () => {});
}
let port = PORT;
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < PORT + 20) { port++; server.listen(port, '127.0.0.1'); return; }
    console.error(e); process.exit(1);
});
server.on('listening', () => {
    const url = 'http://127.0.0.1:' + port + '/';
    const m = meta().apps;
    console.log('Cluster demo ' + DEMO_VERSION + '  (Layouts ' + (m.layouts.version || '?') + ', Centre ' + (m.centre.version || '?') + ', Info ' + (m.info.version || '?') + ')');
    console.log('  settings: ' + url + '?view=controls');
    console.log('  screens:  ' + url + '?view=display');
    console.log('  both in one window: ' + url);
    console.log('(close this window or Ctrl+C to stop)');
    if (OPEN && SINGLE) openBrowser(url);
    else if (OPEN) { openBrowser(url + '?view=controls'); setTimeout(() => openBrowser(url + '?view=display'), 800); }
});
server.listen(port, '127.0.0.1');
