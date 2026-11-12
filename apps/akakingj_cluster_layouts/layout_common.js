'use strict';
/**
 * layout_common.js - what the layouts share: units, the gear's text, temperature scales and piece makers
 * (see engine.js for what a piece is).
 */
const KMH_PER_MPH = 1.609344;
const isNum = (v) => typeof v === 'number' && isFinite(v);

const speedIn = (o, kmh) => (o.speedUnit === 'kmh' ? kmh : kmh / KMH_PER_MPH);
const speedUnit = (o) => (o.speedUnit === 'kmh' ? 'km/h' : 'mph');
const tempIn = (o, c) => (o.tempUnit === 'c' ? c : c * 9 / 5 + 32);
const tempText = (o, c) => (isNum(c) ? Math.round(tempIn(o, c)) + '°' : '--');
const speedText = (o, d) => (isNum(d.speed) ? String(Math.round(speedIn(o, d.speed))) : '--');

/** The speed scale for the unit: { max, major, minor }. */
const speedScale = (o) => (o.speedUnit === 'kmh' ? { max: 260, major: 20, minor: 10 } : { max: 160, major: 20, minor: 5 });
/** Engine speed in thousands: the scale's end (5-10) and the red zone's start. */
function rpmScale(o) {
    const max = Math.max(5, Math.min(10, Math.round((o.rpmMax || 8000) / 1000)));
    return { max, major: 1, minor: 0.25, red: Math.max(2, Math.min(max, (o.redline || 7000) / 1000)) };
}
/*
 * The shift point and the red zone now, worked as cauliflowermossgrape's Redline app works them (GT3 did already):
 * the shift point the red line less Settings > Shift point before redline (300 rpm); with Settings > Cold-engine
 * rev guard on, pulled down to the Cold rev limit (4500 rpm) with the oil at 30 °C and climbing back as the oil
 * reaches Oil warm at (80 °C). The red zone starts that far above the shift point: at the red line once warm, lower
 * while cold (as an M car's variable redline). d: the data (its oil); { rpm, red, cold }.
 */
const SHIFT_DEFAULTS = { shiftBefore: 300, coldLimit: 4500, warmOil: 80 };
const setNum = (o, k) => { const v = o ? Number(o[k]) : NaN; return o && o[k] !== '' && o[k] !== null && o[k] !== undefined && isFinite(v) ? v : SHIFT_DEFAULTS[k]; };
function shiftPoint(o, d) {
    const red = rpmScale(o || {}).red * 1000, before = Math.max(0, setNum(o, 'shiftBefore'));
    const n = Math.max(2500, red - before), oil = d && d.oil, warm = setNum(o, 'warmOil');
    if (!o || o.coldGuard === 'off' || !isNum(oil) || oil >= warm) return { rpm: n, red, cold: false };
    const cold = Math.min(setNum(o, 'coldLimit'), n), f = Math.max(0, Math.min(1, (oil - 30) / Math.max(1, warm - 30)));
    const rpm = Math.round((cold + (n - cold) * f) / 50) * 50;
    return { rpm, red: Math.min(red, rpm + before), cold: true };
}
/** A temperature (°C) on a 40-140 °C scale, 0..1. */
const tempFrac = (c) => (isNum(c) ? Math.max(0, Math.min(1, (c - 40) / 100)) : 0);

/** The gear: P R N, or D / S / M (the selector's programme) with the gear number. */
function gearText(d) {
    if (d.stage === 'P' || d.stage === 'R' || d.stage === 'N') return d.stage;
    if (d.gear === -1) return 'R';
    const g = isNum(d.gear) && d.gear > 0 ? String(d.gear) : '';
    const mode = d.mode === 'S' || d.mode === 'M' ? d.mode : 'D';
    return d.stage === 'D' || g || d.mode ? mode + g : '-';
}
/** The selector letter lit in a P R N D row. */
function selectorLit(d) {
    const g = gearText(d);
    return g === '-' ? '' : g === 'P' || g === 'R' || g === 'N' ? g : 'D';
}
/** The drive mode line: the mode as the car names it (data.js FES_MODES), else S / M from the selector, else the
 * colours' name. */
const modeText = (d, t) => {
    if (d && d.driveMode) return d.driveMode;
    if (d && (d.mode === 'S' || d.mode === 'M')) return d.mode === 'M' ? 'MANUAL' : 'SPORT';
    return t.mode;
};
/* the local time (clock.js: the unit's apps run on UTC; the Time zone setting says where the car is) */
const clock = () => require('./clock').hm();

/* ---------- the map window and the extra readings ---------- */

/** Where waze-on-cluster's map (and the stock map) shows on the panel: the native map area (slot 0x100). With
 * the centre set to 'map', a layout leaves this clear and puts nothing over it. */
const MAP = { x: 416, y: 120, w: 1088, h: 480 };
/** Background rectangles round the map window (top, bottom, left, right). */
const aroundMap = () => [
    { x: 0, y: 0, w: 1920, h: MAP.y }, { x: 0, y: MAP.y + MAP.h, w: 1920, h: 720 - MAP.y - MAP.h },
    { x: 0, y: MAP.y, w: MAP.x, h: MAP.h }, { x: MAP.x + MAP.w, y: MAP.y, w: 1920 - MAP.x - MAP.w, h: MAP.h },
];
/** True when a rectangle overlaps the map window. */
const overMap = (r) => r.x < MAP.x + MAP.w && r.x + r.w > MAP.x && r.y < MAP.y + MAP.h && r.y + r.h > MAP.y;

/*
 * What the cluster's glass shows of the panel (from photos of a G05; the same on every car with this cluster):
 * the top corners are cut on a slant, the camera's cowl covers the top middle, the stock warning lights and
 * the gear's letter sit along the bottom, and while a layout is up the KOMBI leaves a dark box where the stock
 * gear readout was (right of centre). Layouts keep their readings out of these.
 */
const NOTCH = { x: 730, y: 0, w: 460, h: 128 };
/* the KOMBI's own bracket where its gear readout was (measured from a photo of the car: a thick grey bar on
 * top with a slanted left end, a thick bar on the right, a thin line at the bottom, black inside, at about
 * x 1490-1652, y 271-442), with a margin; drawn over us, so kept clear and dressed by boxBezel() */
const GEARBOX_HOLE = { x: 1410, y: 262, w: 252, h: 192 };
/* the bracket's grey (#1e1d21, from the photo against a tile of known colour) */
const BRACKET = '#1e1d21';
/** A bezel in the bracket's own grey behind it, a little larger: its bars merge into it and its black window
 * reads as a recessed screen, not a stray shape. */
const boxBezel = () => ({ key: 'boxBezel', kind: 'panel', x: 1476, y: 258, w: 190, h: 198, params: { u_box: [12, 1.5, 0, 1] },
    colors: () => ({ top: '#232227', bottom: BRACKET, border: '#2e2d33' }) });
/* a second, smaller one at the top right, where the stock eDrive readout sits on a plug-in hybrid */
const EDRIVE_HOLE = { x: 1770, y: 170, w: 150, h: 95 };
/*
 * Settings > Cluster: M car. An M car's KOMBI leaves two more dark boxes in the middle of the panel while a
 * layout is up (its own readouts' places in its M display), measured from one photo of a car showing Digital dash:
 * the photo's perspective fitted to the six tiles' corners (fit within 2 px of the photo, about 4 px here), then
 * the boxes' corners read back. The second box's right and bottom edges were at the tile's edges in the photo,
 * so it may reach further; the holes keep a margin round each (and more to the right and below the second).
 */
const M_BOXES = [{ x: 793, y: 289, w: 246, h: 92 }, { x: 1223, y: 328, w: 171, h: 78 }];
const M_HOLES = [{ x: 778, y: 274, w: 276, h: 122 }, { x: 1208, y: 313, w: 207, h: 113 }];
/** True for an M car (Settings > Cluster) whose boxes show: with the car's own bottom strip (Settings > Bottom
 * strip, the default) the layout ends at y 660 and the KOMBI leaves no boxes, so the layouts keep their own places. */
const mCar = (o) => !!o && o.cluster === 'm' && o.bottomStrip !== 'stock';
/** The KOMBI's dark boxes a layout keeps its readings out of, for this car: the gear box, and an M car's two. */
const holes = (o) => (strip(o) ? [] : [GEARBOX_HOLE, EDRIVE_HOLE].concat(mCar(o) ? M_HOLES : []));
/*
 * Settings > Bottom strip > The car's own (the default): the layout ends at STRIP_Y, the KOMBI's own strip shows
 * below it (its fuel range bottom left, the time, the street, the drive mode and gear, the outside temperature and
 * the electric range bottom right), and the KOMBI's gear bracket and eDrive box don't show: the layouts take their
 * centred places, the ranges' numbers are left to the strip, and the fuel and charge gauges sit above the strip's
 * ranges (stripGauges). 646: 660 just touched the top of the strip's drive mode (photo of the car).
 */
const STRIP_Y = 646;
const strip = (o) => !!o && o.bottomStrip === 'stock';
/** The fuel gauge above the strip's fuel range (bottom left) and the charge above its electric range (bottom
 * right): bars with a word, no numbers (the strip shows the ranges). The charge only on a plug-in hybrid. */
function stripGauges(o, opts) {
    const lab = (t) => ({ color: [t.dim || '#9aa4ae', 1], glow: [t.glow || '#000000', 0] });
    const fuelC = (t) => ({ track: t.track || '#1a1a1a', fill0: t.text || t.tick || '#e8e8e8', fill1: t.text || t.tick || '#e8e8e8', redc: t.red || '#ff3b30', tip: t.text || '#ffffff', tick: t.dim || '#888888', num: t.num || '#888888' });
    const evC = (t) => ({ track: t.track || '#1a1a1a', fill0: t.ev || '#4ab4ff', fill1: t.ev || '#4ab4ff', redc: t.red || '#ff3b30', tip: t.ev || '#4ab4ff', tick: t.dim || '#888888', num: t.num || '#888888' });
    const out = opts && opts.fuel === false ? [] : [
        // each with its level in % beside its name (the strip under it shows the range)
        text('stripFuelLbl', 96, 598, 220, 16, (d) => 'FUEL' + (isNum(d.fuelPct) ? '  ' + Math.round(d.fuelPct) + '%' : ''), lab, { align: 0, tracking: 0.18 }),
        bar('stripFuel', 90, 618, 250, 16, (d) => (isNum(d.fuelPct) ? d.fuelPct / 100 : 0), fuelC, 16),
    ];
    if (o.vehicle !== 'ice') out.push(
        text('stripSocLbl', 1610, 598, 220, 16, (d) => (isNum(d.soc) ? Math.round(d.soc) + '%  ' : '') + 'CHARGE', lab, { align: 1, tracking: 0.18 }),
        bar('stripSoc', 1580, 618, 250, 16, (d) => (isNum(d.soc) ? d.soc / 100 : 0), evC, 16));
    return out;
}
/** The layout's own range readings (keys) left out with the strip: it shows both ranges. */
const STRIP_DROP = /^(fuel|elec|frange|erange|range2)(Lbl)?$|^erangeL$/;

/*
 * A plug-in hybrid in an electric eDrive mode (ELECTRIC, ELECTRIC INDIVIDUAL; the car's drive mode, data.js
 * driveMode), or, before the car has named its mode, with the engine off: the analog layouts' tachs read the
 * battery's power instead (tachDyn, below). In HYBRID, SPORT, BATTERY CONTROL and the rest they are tachs, with a small
 * power gauge inside. Never with Show: Engine or on a petrol or diesel car.
 */
const electric = (o, d) => !engineFocus(o) && !!o && o.vehicle !== 'ice' && !!d
    && (typeof d.driveMode === 'string' && d.driveMode ? /ELECTRIC/.test(d.driveMode) : d.engineOn === false);
/*
 * The power gauges: 0 a quarter along (KW_ZERO), the battery's power drawn above it to the gauge's top, the
 * regeneration below it to its start, each side on its own scale. The ends are eDrive Live's (the battery's
 * discharge and charge limits, data.js kwOut / kwIn), else 100 and 35 kW.
 */
const KW_ZERO = 0.25;
const KW_FLOOR = -500;                  // (a dial's lowest value passed on: the engine's clamp; the gauge clamps itself)
const REGEN_RGB = [0.24, 0.86, 0.52];   // (#3ddc84, the layouts' regeneration green)
/** The gauge's ends now: { out, in } kW. */
const kwRange = (d) => ({ out: d && isNum(d.kwOut) && d.kwOut >= 20 ? d.kwOut : 100, in: d && isNum(d.kwIn) && d.kwIn >= 5 ? d.kwIn : 35 });
/** kW as a place along a power gauge (0..1, 0 kW at z). */
const kwFrac = (kw, r, z) => {
    const zz = isNum(z) ? z : KW_ZERO;
    if (!isNum(kw)) return zz;
    return kw >= 0 ? zz + (1 - zz) * Math.min(1, kw / r.out) : zz * (1 - Math.min(1, -kw / r.in));
};
/** A round scale for out kW: { max, major, minor }, its numerals every major (4-5 of them). */
function kwDialScale(out) {
    const major = [20, 25, 40, 50].find((m) => Math.ceil(out / m) <= 5) || 100;
    return { max: Math.ceil(out / major) * major, major, minor: major / 5 };
}
/** A tach dial's dyn, value and range: kW in an electric mode (0 a quarter round), else the engine speed
 * (s: rpmScale(o), red where it is). */
const tachDyn = (o, s, red) => (d) => {
    // (the red zone where the shift point puts it now: lower while the oil is cold)
    if (!electric(o, d)) return { u_scale: [s.max, s.major, s.minor, Math.min(red, shiftPoint(o, d).red / 1000)], u_min: [0], u_zero: [0], u_regen: REGEN_RGB };
    const r = kwRange(d), k = kwDialScale(r.out);
    return { u_scale: [k.max, k.major, k.minor, k.max + 1], u_min: [-r.in], u_zero: [KW_ZERO], u_regen: REGEN_RGB };
};
const tachValue = (o) => (d) => {
    if (!electric(o, d)) return isNum(d.rpm) ? d.rpm / 1000 : 0;
    const r = kwRange(d);
    return isNum(d.kw) ? Math.max(-r.in, Math.min(kwDialScale(r.out).max, d.kw)) : 0;
};
const tachRange = (o, s) => (d) => (electric(o, d) ? [-kwRange(d).in, kwDialScale(kwRange(d).out).max] : [0, s.max]);
/* The readings put where the time and outside temperature were, with the car's own bottom strip (which shows
 * both): on a petrol or diesel car the two picked in Settings > Readout 1 / 2 (intake air and the gearbox oil's
 * by default), on a plug-in hybrid the battery's temperature and the gearbox oil's. box: the piece's { w, h }: the
 * long names where they fit ('INTAKE AIR 31°'), else the short ('IAT 31°'). */
const stripInfoA = (o, box) => (o.vehicle === 'ice' || engineFocus(o)
    ? readout(o, o.infoA || 'iat', box) : (d) => 'BATT ' + tempText(o, d.battTemp));
const stripInfoB = (o, box) => (o.vehicle === 'ice' || engineFocus(o)
    ? readout(o, o.infoB || 'gearbox', box) : (d) => 'GEARBOX ' + tempText(o, d.gearbox));

/*
 * A tach's power meter (a plug-in hybrid's eDrive scale): an inner arc across the top of the tach, 0 a quarter
 * along it (40 degrees left of twelve o'clock); right of it the power drawn from the battery (blue, 120 degrees, to
 * the battery's limit), left of it charging and recuperation (green, 40 degrees, to its limit): eDrive Live's ends
 * (kwRange), numbered in round steps. lbl: the label's colours.
 */
function powerMeter(cx, size, cy, lbl, o) {
    const k = size / 640, r = Math.round(150 * k), th = Math.max(8, Math.round(12 * k)), half = r + th + Math.round(22 * k);
    const box = { x: cx - half, y: cy - half, w: half * 2, h: half };     // the top half around the dial's centre
    // (each side's end rounded: the power drawn to 20 kW, in 4 marks; the regeneration to 10 kW, in 2)
    const outN = (d) => Math.ceil(kwRange(d).out / 20) * 20, inN = (d) => Math.ceil(kwRange(d).in / 10) * 10;
    const arc = (key, a0, a1, value, colour, marks, end) => ({
        key, kind: 'band', x: box.x, y: box.y, w: box.w, h: box.h + th, z: 2,
        params: { u_geo: [half, half, r, th], u_span: [a0, a1, 0, 0], u_marks: [marks, 25, Math.round(19 * k), -Math.round(24 * k)], u_red: [2] },
        colors: (t) => ({ track: t.track, fill0: colour(t), fill1: colour(t), redc: t.red, tip: colour(t), tick: t.dim, num: t.num }),
        dyn: (d) => ({ u_marks: [marks, end(d) / marks, Math.round(19 * k), -Math.round(24 * k)] }),
        value, max: 1, sweep: true,
        // (gone while the dial itself reads the battery's power: an electric mode)
        visible: o ? (d) => !electric(o, d) : undefined,
    });
    return [
        arc('kwDraw', -40, 80, (d) => Math.max(0, Math.min(1, (isNum(d.kw) ? d.kw : 0) / outN(d))), (t) => t.ev, 4, outN),
        arc('kwRegen', -40, -80, (d) => Math.max(0, Math.min(1, -(isNum(d.kw) ? d.kw : 0) / inN(d))), (t) => t.regen || '#3ddc84', 2, inN),
        Object.assign(text('kwLbl', cx - 40, cy - r + Math.round(46 * k), 80, Math.round(20 * k), 'kW', lbl, { tracking: 0.04 }), o ? { visible: (d) => !electric(o, d) } : {}),
    ];
}

/* the stock warning lights and the fallback gear letter along the bottom middle */
const TELLTALES = { x: 560, y: 652, w: 960, h: 68 };
/** Rectangles covering r but not hole: r itself when they don't meet, else up to four around the hole (the
 * background drawn around the KOMBI's dark box, so nothing of ours sits under it). */
function cut(r, hole) {
    const hx = Math.max(r.x, hole.x), hy = Math.max(r.y, hole.y), hx2 = Math.min(r.x + r.w, hole.x + hole.w), hy2 = Math.min(r.y + r.h, hole.y + hole.h);
    if (hx >= hx2 || hy >= hy2) return [r];
    return [
        { x: r.x, y: r.y, w: r.w, h: hy - r.y },                       // above
        { x: r.x, y: hy2, w: r.w, h: r.y + r.h - hy2 },                // below
        { x: r.x, y: hy, w: hx - r.x, h: hy2 - hy },                   // left
        { x: hx2, y: hy, w: r.x + r.w - hx2, h: hy2 - hy },            // right
    ].filter((q) => q.w > 0 && q.h > 0);
}
/** True when a point is inside the glass's slanted top corners (hidden). */
const inCorner = (x, y) => y < 217 - 0.55 * Math.min(x, 1920 - x);

/** A distance in km as the speed unit wants it: '312 MI', '502 KM', or '--'. */
const distText = (o, km) => (isNum(km) ? Math.round(o.speedUnit === 'kmh' ? km : km / KMH_PER_MPH) + (o.speedUnit === 'kmh' ? ' km' : ' mi') : '--');
/** The electric range: '~31 MI' when it is the estimate from the charge (data.js), else as distText. */
const erangeText = (o, d) => (isNum(d.erange) && d.erangeEst ? '~' : '') + distText(o, d.erange);
/*
 * Settings > Vehicle: a plug-in hybrid (o.vehicle 'phev', the eDrive readings) or a petrol or diesel car
 * ('ice'). With ICE the layouts trade their eDrive readings for the engine's: battery power -> engine torque, charge -> ignition timing, electric range -> boost, the charge bar
 * -> boost against its target. Each helper takes o and gives the reading for the choice.
 */
const engineFocus = (o) => !!o && (o.vehicle === 'ice' || o.focus === 'engine');
/**
 * Pressures (boost and fuel rail, bar in the data) in Settings > Pressure unit: psi, bar or kPa, or (the
 * default, 'auto') with the speed unit as before: psi with mph, bar with km/h. Only the figures change: every
 * bar, gauge and range works in bar, so a full bar means the same in any unit.
 */
const pressUnitOf = (o) => (o && (o.pressUnit === 'psi' || o.pressUnit === 'bar' || o.pressUnit === 'kpa') ? o.pressUnit
    : o && o.speedUnit === 'kmh' ? 'bar' : 'psi');
const pressIn = (o, bar) => (pressUnitOf(o) === 'psi' ? bar * 14.5038 : pressUnitOf(o) === 'kpa' ? bar * 100 : bar);
/** a pressure's figures: bar to a hundredth (whole from 10, the rail), psi to a tenth (whole from 100), kPa whole */
const pressNum = (o, bar) => {
    if (!isNum(bar)) return '--';
    const u = pressUnitOf(o), v = pressIn(o, bar);
    if (u === 'bar') return Math.abs(v) < 10 ? v.toFixed(2) : String(Math.round(v));
    if (u === 'psi') return Math.abs(v) < 100 ? v.toFixed(1) : String(Math.round(v));
    return String(Math.round(v));
};
const pressLabel = (o) => ({ psi: 'psi', bar: 'bar', kpa: 'kPa' })[pressUnitOf(o)];
const boostText = (o, d) => (d.engineOn === false ? 'OFF' : isNum(d.boostActual) ? pressNum(o, d.boostActual) + ' ' + pressLabel(o) : '--');
/** Engine torque (Nm) in Settings > Torque unit: Nm, kgm (to a tenth) or lb-ft. */
const torqueOf = (o) => (o && (o.torqueUnit === 'kgm' || o.torqueUnit === 'lbft') ? o.torqueUnit : 'nm');
const torqueNum = (o, nm) => (!isNum(nm) ? '--' : torqueOf(o) === 'kgm' ? (nm / 9.80665).toFixed(1)
    : String(Math.round(torqueOf(o) === 'lbft' ? nm * 0.737562 : nm)));
const torqueUnit = (o) => ({ nm: 'Nm', kgm: 'kgm', lbft: 'lb-ft' })[torqueOf(o)];
const torqueText = (o) => (d) => (isNum(d.torque) ? torqueNum(o, d.torque) + ' ' + torqueUnit(o) : '--');
/** Ignition timing: a tenth under 10 degrees, whole from 10 ('24°': '24.0°' ran over Track's tile). */
const timingText = (d) => (isNum(d.timing) ? (Math.abs(d.timing) < 10 ? d.timing.toFixed(1) : String(Math.round(d.timing))) + '°' : '--');
/** Boost (bar over atmosphere) 0..1.6 as 0..1. */
const boostFrac = (d) => (d.engineOn === false || !isNum(d.boostActual) ? 0 : Math.max(0, Math.min(1, d.boostActual / 1.6)));
/** The engine's power (kW, data.js: its torque x its speed) in Settings > Power unit: hp (the default), PS or kW. */
const powerOf = (o) => (o && (o.powerUnit === 'ps' || o.powerUnit === 'kw') ? o.powerUnit : 'hp');
const powerNum = (o, kw) => (!isNum(kw) ? '--' : String(Math.round(powerOf(o) === 'kw' ? kw : kw * (powerOf(o) === 'ps' ? 1.35962 : 1.34102))));
const powerUnitText = (o) => ({ hp: 'hp', ps: 'PS', kw: 'kW' })[powerOf(o)];
const tempOf = (k) => (o, d) => tempText(o, d[k]);
const numOrOff = (f) => (o, d) => (d.engineOn === false ? 'OFF' : f(o, d));
/*
 * The readouts a petrol or diesel car's displays can pick (Settings > Readout 1, Readout 2, Main readout):
 * short: the name where room is short; long: where there is room; num: the figures; unit: after them (none for
 * the temperatures and the pedal, whose figures carry theirs); frac: 0..1 for a bar under it; needs: what the engine
 * unit must read for it (data.js).
 */
const READOUTS = {
    iat: { short: 'IAT', long: 'INTAKE AIR', num: tempOf('iat'), frac: (d) => (isNum(d.iat) ? d.iat / 80 : 0), needs: ['iat'] },
    gearbox: { short: 'TRANS', long: 'TRANS OIL', num: tempOf('gearbox'), frac: (d) => (isNum(d.gearbox) ? (d.gearbox - 40) / 90 : 0), needs: ['gearbox'] },
    oil: { short: 'OIL', long: 'ENGINE OIL', num: tempOf('oil'), frac: (d) => (isNum(d.oil) ? (d.oil - 40) / 100 : 0) },
    coolant: { short: 'CLT', long: 'COOLANT', num: tempOf('coolant'), frac: (d) => (isNum(d.coolant) ? (d.coolant - 40) / 90 : 0) },
    boost: { short: 'BST', long: 'BOOST', num: numOrOff((o, d) => pressNum(o, d.boostActual)), unit: (o) => pressLabel(o), frac: (d) => boostFrac(d), needs: ['boostActual', 'boostTarget'] },
    power: { short: (o) => powerUnitText(o).toUpperCase(), long: 'ENGINE POWER', num: (o, d) => powerNum(o, d.enginePower), unit: (o) => powerUnitText(o), frac: (d) => (isNum(d.enginePower) ? d.enginePower / 200 : 0) },
    torque: { short: 'TQ', long: 'ENGINE TORQUE', num: (o, d) => torqueNum(o, d.torque), unit: (o) => torqueUnit(o), frac: (d) => (isNum(d.torque) ? d.torque / 450 : 0) },
    throttle: { short: 'THR', long: 'THROTTLE', num: (o, d) => (isNum(d.throttle) ? Math.round(d.throttle) + '%' : '--'), frac: (d) => (isNum(d.throttle) ? d.throttle / 100 : 0), needs: ['throttle'] },
    pedal: { short: 'PDL', long: 'PEDAL', num: (o, d) => (isNum(d.pedal) ? Math.round(d.pedal) + '%' : '--'), frac: (d) => (isNum(d.pedal) ? d.pedal / 100 : 0), needs: ['pedal'] },
    timing: { short: 'TIM', long: 'TIMING', num: (o, d) => timingText(d), frac: (d) => (isNum(d.timing) ? (d.timing + 10) / 50 : 0), needs: ['timing'] },
};
const readoutOf = (k) => READOUTS[k] || null;
/*
 * Temperatures in colour (Settings > Temperature colours): blue while cold, the oil amber while warming, red when too
 * hot, as Cluster Centre's tiles (readings.js: oil and coolant cold under 60 °C, the gearbox oil under 50; the oil
 * warming up to Oil warm at; hot from Settings > Too hot: oil, coolant, gearbox (130, 118, 115 °C; the Car profile's
 * when it sets them: hotAt); the intake air from 60). toneOf: 'cold', 'warm', 'hot' or null for a reading now; toned: a
 * piece's colours with it. The same temperatures start the red on every layout's temperature gauges and figures.
 */
/*
 * Temperature gauges as the car's own (Settings > Temperature gauges: C-H, the default): C at the cold end, H at the hot
 * end, the needle in the middle across the range an engine runs at once warm (as BMW's coolant gauge stays in the
 * middle), climbing towards H only above it; red from CH_RED. chOf(o, k): k when that reading is shown so; chFrac:
 * a temperature (°C) as 0..1 on that gauge.
 */
const CH = { coolant: { c: 40, lo: 80, hi: 105, h: 125 }, oil: { c: 40, lo: 85, hi: 115, h: 140 }, gearbox: { c: 30, lo: 65, hi: 95, h: 125 } };
const CH_RED = 0.85;
const chOf = (o, k) => (o && o.tempGauge !== 'scale' && CH[k] ? k : null);
function chFrac(k, v) {
    const r = CH[k];
    if (!r || !isNum(v) || v <= r.c) return 0;
    if (v < r.lo) return 0.45 * (v - r.c) / (r.lo - r.c);
    if (v <= r.hi) return 0.45 + 0.1 * (v - r.lo) / (r.hi - r.lo);
    return v < r.h ? 0.55 + 0.45 * (v - r.hi) / (r.h - r.hi) : 1;
}
/** C and H at a small gauge's ends: two text pieces at radius r round (cx, cy), at angles a0 and a1 (degrees from
 * twelve o'clock, clockwise), letters size high; H in the red. */
function chMarks(key, cx, cy, r, a0, a1, size, colors) {
    const pos = (a) => [cx + Math.sin(a * Math.PI / 180) * r, cy - Math.cos(a * Math.PI / 180) * r];
    const w = Math.round(size * 1.6), mk = (k, a, s, c) => { const [x, y] = pos(a); return text(key + k, Math.round(x - w / 2), Math.round(y - size / 2), w, size, s, c); };
    return [mk('C', a0, 'C', colors), mk('H', a1, 'H', (t) => ({ color: [t.red || '#ff3b30', 1], glow: [t.red || '#ff3b30', 0.3] }))];
}
const TEMP_TONES = { oil: { cold: 60, hot: 130 }, coolant: { cold: 60, hot: 118 }, gearbox: { cold: 50, hot: 115 }, iat: { hot: 60 } };
// too hot from (°C): the setting's, else TEMP_TONES' (the settings' defaults)
const HOT_KEY = { oil: 'hotOil', coolant: 'hotCoolant', gearbox: 'hotGearbox' };
const hotAt = (o, k) => {
    const s = HOT_KEY[k], v = o && s ? Number(o[s]) : NaN;
    if (o && s && o[s] !== '' && o[s] !== null && o[s] !== undefined && isFinite(v) && v > 0) return v;
    return TEMP_TONES[k] && isNum(TEMP_TONES[k].hot) ? TEMP_TONES[k].hot : NaN;
};
/** Where the red starts on a C-H gauge of k (0..1): at its too-hot temperature (CH_RED for any other reading). */
const chRed = (o, k) => (CH[k] && isNum(hotAt(o, k)) ? chFrac(k, hotAt(o, k)) : CH_RED);
const TONE_RGB = { cold: '#4ab4ff', warm: '#ffc21a', hot: '#ff3b30' };
// (the oil amber from cold up to Settings > Cold engine: oil warm at (warmOil), as the Redline app's HUD and Cluster
// Centre's tiles: the cold-engine guard still lowering the shift point)
const toneOf = (k, d, o) => {
    const r = TEMP_TONES[k], v = d && d[k], hot = hotAt(o, k);
    if (!r || !isNum(v)) return null;
    if (isNum(hot) && v >= hot) return 'hot';
    if (isNum(r.cold) && v < r.cold) return 'cold';
    const warm = k === 'oil' && o ? setNum(o, 'warmOil') : NaN;      // (unset: 80, as the shift point's)
    return isFinite(warm) && v < warm ? 'warm' : null;
};
const toned = (colors, k, o) => (t, d) => {
    const c = typeof colors === 'function' ? colors(t, d) : colors, tone = toneOf(k, d, o);
    if (!tone || !c || !c.color) return c;
    const col = TONE_RGB[tone];
    return Object.assign({}, c, { color: [col, c.color[1]] }, c.glow ? { glow: [col, Math.min(0.3, c.glow[1])] } : {});
};
/**
 * A text piece made to hold its widest figures (READOUT_SAMPLES, below): its glyphs smaller, centred in the same
 * box, where they would run over it (the font sets glyphs at most 15% closer). room: the share of the box's width
 * to fill (under 1: a gap kept, for two texts side by side). fam: the layout's glyph family.
 */
function fitText(p, fam, room) {
    const a = require('./font').atlas(fam || 'bold');
    const width = (t) => Array.from(t).reduce((x, ch) => { const c = a.code(ch); return x + (c < 0 ? 0.3 : ch === ' ' ? Math.max(a.adv[c], 0.32) : a.adv[c]); }, 0);
    const texts = READOUT_SAMPLES.map((d) => { try { return String(typeof p.text === 'function' ? p.text(d) : p.text); } catch (e) { return ''; } });
    const need = Math.max(0, ...texts.map(width)) * 0.85, w = p.w * (room || 1);
    if (!need || need * p.h <= w) return p;
    const h = Math.max(10, Math.floor(w / need));
    return Object.assign({}, p, { y: p.y + Math.round((p.h - h) / 2), h });
}
/** The readings at their widest figures (three-figure temperatures, the most negative timing and boost ...): what a
 * readout's box is sized to hold (layouts.js), and what tools/check_fit.js measures every text with. */
const READOUT_SAMPLES = [
    { oil: 150, coolant: 130, iat: 79, gearbox: 140, boostActual: 1.6, enginePower: 199, torque: 449, pedal: 100, throttle: 100, timing: -10, fuelPct: 100, rpm: 7000, speed: 250, engineOn: true, outside: -20 },
    { oil: 8, coolant: 8, iat: -9, gearbox: 8, boostActual: -0.65, enginePower: 0, torque: 0, pedal: 0, throttle: 0, timing: 8.5, fuelPct: 5, rpm: 800, speed: 0, engineOn: true, outside: 9 },
];
const nameOf = (r, o, long) => { const n = long ? r.long : r.short; return typeof n === 'function' ? n(o) : n; };
/** A readout on one line, its name first: 'IAT 31°', 'BST 14.5' ('INTAKE AIR 31°', 'BOOST 14.5 psi' where it
 * fits: a box with room for its longest form). key 'off': nothing. */
function readout(o, key, box, longAlways) {
    const r = readoutOf(key);
    if (!r) return '';
    // (about 0.6 of the height a character, as the bold face sets capitals and figures)
    const room = box && box.w && box.h ? box.w / (box.h * 0.6) : 0;
    const long = longAlways || room >= nameOf(r, o, true).length + 10;
    return (d) => nameOf(r, o, long) + ' ' + r.num(o, d) + (long && r.unit && r.num(o, d) !== '--' && r.num(o, d) !== 'OFF' ? ' ' + r.unit(o) : '');
}
/*
 * The small gauges set into the analog dials (Settings > Speedometer gauge / Tach gauge; 'auto': the layout's
 * own): each reading's scale (in the data's units: °C, bar, kW, Nm, %), its red zone from `red` up (none: null; the
 * temperatures' from Settings > Too hot: gaugeOf),
 * its label and its figures. frac 0..1 on the scale; redFrac where the red zone starts (over 1: none).
 */
const GAUGES = {
    coolant: { label: 'COOLANT', min: 40, max: 140, red: 118, v: (d) => d.coolant, text: tempOf('coolant') },
    oil: { label: 'OIL', min: 40, max: 140, red: 130, v: (d) => d.oil, text: tempOf('oil') },
    iat: { label: 'INTAKE', min: 0, max: 80, red: 60, v: (d) => d.iat, text: tempOf('iat'), needs: ['iat'] },
    gearbox: { label: 'TRANS', min: 40, max: 140, red: 115, v: (d) => d.gearbox, text: tempOf('gearbox'), needs: ['gearbox'] },
    boost: { label: 'BOOST', min: 0, max: 1.6, red: null, v: (d) => (d.engineOn === false ? 0 : d.boostActual), text: (o, d) => { const n = numOrOff((o2, d2) => pressNum(o2, d2.boostActual))(o, d); return n === '--' || n === 'OFF' ? n : n + ' ' + pressLabel(o); }, needs: ['boostActual', 'boostTarget'] },
    power: { label: 'POWER', min: 0, max: 200, red: null, v: (d) => d.enginePower, text: (o, d) => { const n = powerNum(o, d.enginePower); return n === '--' ? n : n + ' ' + powerUnitText(o); } },
    torque: { label: 'TORQUE', min: 0, max: 450, red: null, v: (d) => d.torque, text: (o, d) => { const n = torqueNum(o, d.torque); return n === '--' ? n : n + ' ' + torqueUnit(o); } },
    throttle: { label: 'THROTTLE', min: 0, max: 100, red: null, v: (d) => d.throttle, text: (o, d) => (isNum(d.throttle) ? Math.round(d.throttle) + '%' : '--'), needs: ['throttle'] },
    pedal: { label: 'PEDAL', min: 0, max: 100, red: null, v: (d) => d.pedal, text: (o, d) => (isNum(d.pedal) ? Math.round(d.pedal) + '%' : '--'), needs: ['pedal'] },
    timing: { label: 'TIMING', min: -10, max: 40, red: null, v: (d) => d.timing, text: (o, d) => timingText(d), needs: ['timing'] },
    fuel: { label: 'FUEL', min: 0, max: 100, red: null, v: (d) => d.fuelPct, text: (o, d) => (isNum(d.fuelPct) ? Math.round(d.fuelPct) + '%' : '--') },
};
/** The gauge picked for the speedometer ('speed') or the tach ('rpm'), or null for the layout's own. */
const gaugeOf = (o, which) => {
    const k = o && (which === 'speed' ? o.gaugeSpeed : o.gaugeRpm);
    const g0 = k && GAUGES[k];
    if (!g0) return null;
    // (a temperature's red zone from its too-hot temperature: hotAt)
    const g = HOT_KEY[k] ? Object.assign({}, g0, { red: hotAt(o, k) }) : g0;
    return Object.assign({ key: k }, g, {
        frac: (d) => { const v = g.v(d); return isNum(v) ? Math.max(0, Math.min(1, (v - g.min) / (g.max - g.min))) : 0; },
        redFrac: isNum(g.red) ? (g.red - g.min) / (g.max - g.min) : 1.01,
        hot: (d) => isNum(g.red) && isNum(g.v(d)) && g.v(d) >= g.red,
        txt: (d) => g.text(o, d),
    });
};
const mainKey = (o) => (readoutOf(o && o.infoMain) ? o.infoMain : 'torque');
const focus = {
    /** a petrol or diesel car's main readout (Settings > Main readout: the engine torque by default), with its unit */
    power: (o) => {
        if (!engineFocus(o)) return kwText;
        const r = readoutOf(mainKey(o));
        return (d) => { const n = r.num(o, d); return n + (r.unit && n !== '--' && n !== 'OFF' ? ' ' + r.unit(o) : ''); };
    },
    powerLabel: (o, long) => (engineFocus(o) ? nameOf(readoutOf(mainKey(o)), o, true).replace('ENGINE ', long ? 'ENGINE ' : '') : (long ? 'BATTERY POWER' : 'POWER')),
    /** 0..1 for the main readout's bar (the torque to 450 Nm by default), or none (the eDrive layouts draw their own centre-zero bar) */
    mainFrac: (o) => { const r = readoutOf(mainKey(o)); return (d) => Math.max(0, Math.min(1, r.frac(d) || 0)); },
    torqueFrac: (d) => (isNum(d.torque) ? Math.max(0, Math.min(1, d.torque / 450)) : 0),
    charge: (o) => (engineFocus(o) ? timingText : socText),
    chargeLabel: (o) => (engineFocus(o) ? 'TIMING' : 'CHARGE'),
    range: (o) => (engineFocus(o) ? (d) => boostText(o, d) : (d) => erangeText(o, d)),
    rangeLabel: (o) => (engineFocus(o) ? 'BOOST' : 'ELECTRIC'),
    /** the electric range and charge on one line, or the boost and timing */
    both: (o) => (engineFocus(o) ? (d) => boostText(o, d) + '  ' + timingText(d) : (d) => erangeText(o, d) + '  ' + socText(d)),
    bar: (o) => (engineFocus(o) ? boostFrac : (d) => (isNum(d.soc) ? d.soc / 100 : 0)),
    /** what the engine readings need read from the engine unit */
    needs: (o) => (engineFocus(o) ? ['boostActual', 'boostTarget', 'timing', 'hpfp'].concat(...[o.infoA || 'iat', o.infoB || 'gearbox', mainKey(o), o.infoLow || 'coolant'].map((k) => (readoutOf(k) && readoutOf(k).needs) || []),
        ...[o.gaugeSpeed, o.gaugeRpm].map((k) => (GAUGES[k] && GAUGES[k].needs) || [])) : []),
};
/** Outside temperature with its unit letter: '48°F'. */
const outsideText = (o, c) => (isNum(c) ? Math.round(tempIn(o, c)) + '°' + (o.tempUnit === 'c' ? 'C' : 'F') : '--');
const socText = (d) => (isNum(d.soc) ? Math.round(d.soc) + '%' : '--');
const kwText = (d) => (isNum(d.kw) ? (d.kw > 0.05 ? '+' : '') + (Math.abs(d.kw) < 10 ? d.kw.toFixed(1) : Math.round(d.kw)) + ' kW' : '--');

/** A reading with its label under it: two text pieces. */
function reading(key, x, y, w, h, value, label, colors, labelColors) {
    return [
        text(key, x, y, w, h, value, colors),
        text(key + 'Lbl', x, y + h + Math.round(h * 0.14), w, Math.max(18, Math.round(h * 0.4)), label, labelColors, { tracking: 0.12 }),
    ];
}
/** A reading with its label above it (where the row must end above the warning lights): label 16 px, then the
 * value h high. */
function readingUp(key, x, y, w, h, value, label, colors, labelColors) {
    return [
        text(key + 'Lbl', x, y, w, 16, label, labelColors, { tracking: 0.1 }),
        text(key, x, y + 18, w, h, value, colors),
    ];
}
/** A straight bar (band shader in bar mode): value(d) 0..1. */
function bar(key, x, y, w, h, value, colors, segments) {
    return { key, kind: 'band', x, y, w, h, params: { u_geo: [4, h / 2, 0, Math.max(4, h - 8)], u_span: [0, 0, segments || 0, 0.25], u_marks: [0, 0, 0, 0], u_red: [2] },
        colors, value, max: 1, sweep: true };
}

/** A text piece. */
const text = (key, x, y, w, h, txt, colors, extra) => Object.assign({ key, kind: 'text', x, y, w, h, text: txt, colors, align: 0.5 }, extra || {});
/** A flat rectangle. */
const flat = (key, x, y, w, h, colour) => ({ key, kind: 'flat', x, y, w, h, colors: (t, d) => ({ color: [typeof colour === 'function' ? colour(t, d) : t[colour], 1] }) });

module.exports = {
    isNum, speedIn, speedUnit, tempIn, tempText, speedText, speedScale, rpmScale, shiftPoint, tempFrac, gearText, selectorLit, clock, modeText, text, flat,
    STRIP_Y, strip, stripGauges, STRIP_DROP, electric, KW_ZERO, KW_FLOOR, REGEN_RGB, kwRange, kwFrac, kwDialScale, powerMeter, tachDyn, tachValue, tachRange, stripInfoA, stripInfoB, MAP, aroundMap, overMap, cut, NOTCH, GEARBOX_HOLE, boxBezel, EDRIVE_HOLE, M_BOXES, M_HOLES, mCar, holes, TELLTALES, inCorner, distText, erangeText, outsideText, socText, kwText, reading, readingUp, bar, engineFocus, focus, pressUnitOf, pressNum, pressLabel, boostText, torqueText, torqueNum, torqueUnit, timingText, boostFrac, READOUTS, READOUT_SAMPLES, fitText, TEMP_TONES, HOT_KEY, hotAt, toneOf, toned, CH, CH_RED, chRed, chOf, chFrac, chMarks, readout, powerNum, powerUnitText, GAUGES, gaugeOf,
};
