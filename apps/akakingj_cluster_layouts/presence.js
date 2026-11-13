'use strict';
/**
 * presence.js - which of these apps is on the cluster now, so they don't both draw: a layout covers the whole
 * panel (Cluster Centre's pages under it would be hidden, yet take dozens of the renderer's 96 layers and
 * leave the layout's last pieces refused). Each app touches a file in /dev/shm while it shows; the other
 * checks it. (Cluster Layouts also says what its centre holds, for the logs.)
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.CLUSTER_PRESENCE_DIR || '/dev/shm/cluster-layouts';
const FRESH_MS = 3000;
let last = 0;
const opened = {};

/** Says `name` is showing now (written at most once a second), with `extra` (plain JSON) for the other app. */
function mark(name, extra) {
    const now = Date.now();
    if (now - last < 1000) return;
    last = now;
    try {
        // (readable by the other app, which runs as another user, whatever this one's umask: the folder 0755, the
        // file 0644, each set once)
        try { fs.mkdirSync(DIR, 0o755); } catch (e) { if (e.code !== 'EEXIST') throw e; }
        if (!opened['/']) { opened['/'] = true; try { fs.chmodSync(DIR, 0o755); } catch (e) { /* not ours */ } }
        // (written whole: a temp file renamed over it, so the other app never reads half of it)
        const f = path.join(DIR, name + '.json'), tmp = f + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(Object.assign({}, extra, { at: now })), { mode: 0o644 });
        try { fs.chmodSync(tmp, 0o644); } catch (e) { /* the mode given above */ }
        fs.renameSync(tmp, f);
    } catch (e) { /* tmpfs not there: nothing shared */ }
}
/** True while `name` has said it is showing in the last FRESH_MS (the file read at most twice a second). */
const seen = new Map();
function active(name) {
    const now = Date.now(), c = seen.get(name);
    if (!c || now - c.read > 500) {
        let v = {};
        try { v = JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8')) || {}; } catch (e) {
            // not there: not showing; a file that doesn't read whole (an older writer's, mid-write): the last reading stands
            if (c && e.code !== 'ENOENT') { c.read = now; return now - c.at < FRESH_MS; }
        }
        seen.set(name, { read: now, at: v.at || 0, v });
    }
    return now - seen.get(name).at < FRESH_MS;
}
/** What `name` said with its mark ({} when it isn't showing). */
const info = (name) => (active(name) ? seen.get(name).v : {});

module.exports = { mark, active, info, DIR };
