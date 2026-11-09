'use strict';
/**
 * shaders.js - the GLSL ES 1.00 fragment shaders the instrument cluster runs to draw a layout.
 *
 * The cluster render service publishes a RAMSES scene; the KOMBI's own renderer subscribes to it and draws
 * it on the cluster's GPU. So nothing here is drawn on the head unit and no picture is sent: each piece of
 * a layout is an effect layer (one of these shaders over a rectangle), and what changes while driving is a
 * uniform (a needle's value: one number) or a few glyph codes. The only pixels ever sent are the glyph
 * atlas (font.js), once.
 *
 * Coordinates: v_uv runs 0..1 from the layer's top-left (the service's quad vertex shader); the shaders work
 * in the layer's pixels (u_size). Angles are degrees clockwise from 12 o'clock. The glyph atlas holds signed
 * distance fields (0.5 at the outline), so numerals stay sharp at any size and can glow.
 *
 * Kinds (engine.js makes the layers): FLAT a colour; PANEL a rounded card with a gradient and an edge; DIAL a
 * round dial with its needle; BAND a gauge along an arc of a circle (segmented or solid); TEXT a line of
 * glyphs.
 */

const HIGHP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

const COMMON = `
const float DEG = 0.017453293;
/* 1 inside a..b, with a pixel's soft edge */
float span(float x, float a, float b) { return clamp(x - a + 0.5, 0.0, 1.0) * clamp(b - x + 0.5, 0.0, 1.0); }
/* straight-alpha "over": c at coverage a over acc */
vec4 over(vec4 acc, vec3 c, float a) {
    float oa = a + acc.a * (1.0 - a);
    if (oa <= 0.0) return vec4(0.0);
    return vec4((c * a + acc.rgb * acc.a * (1.0 - a)) / oa, oa);
}
`;

/* Glyph lookup: code (cell) and a point in its box (g.x glyph heights from its centre line, g.y 0..1 from
 * the top) -> the distance field value, 0 outside the glyph's cell. */
const GLYPH = `
uniform sampler2D u_font;
uniform vec3 u_font_cells;        /* cells a row, a cell's width in glyph heights, rows */
float sdf(float code, vec2 g) {
    float u = 0.5 + g.x / u_font_cells.y;
    if (code < 0.0 || u < 0.0 || u > 1.0 || g.y < 0.0 || g.y > 1.0) return 0.0;
    float row = floor(code / u_font_cells.x + 0.001), col = code - row * u_font_cells.x;
    return texture2D(u_font, vec2((col + u) / u_font_cells.x, (row + g.y) / u_font_cells.z)).r;
}
/* a number's digit i (0 = leftmost) of n digits */
float digitOf(float v, float i, float n) {
    float p = n - 1.0 - i;
    float div = p < 0.5 ? 1.0 : p < 1.5 ? 10.0 : 100.0;
    return mod(floor(v / div + 0.001), 10.0);
}
`;

/** A flat colour over the layer. */
const FLAT_FS = `#version 100
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

/**
 * A rounded card of glass: a vertical gradient, a faint diagonal sheen, a light along its top edge, a border
 * brighter at the top than the bottom, and a soft shadow inside its lower edge.
 *   u_box     corner radius, border width, top light (0..1), opacity
 */
const PANEL_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform vec4 u_box;
uniform vec3 u_top;
uniform vec3 u_bottom;
uniform vec3 u_border;
varying vec2 v_uv;
void main() {
    vec2 p = v_uv * u_size, h = u_size * 0.5, q = abs(p - h) - (h - u_box.x);
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_box.x;   /* < 0 inside */
    float inside = clamp(0.5 - dist, 0.0, 1.0);
    if (inside <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 col = mix(u_top, u_bottom, v_uv.y);
    col += vec3(1.0) * 0.022 * u_box.z * smoothstep(0.55, 0.0, abs(v_uv.x - v_uv.y * 0.6 - 0.15));
    col += u_border * u_box.z * 0.45 * clamp(1.0 - p.y / 22.0, 0.0, 1.0);
    col *= 1.0 - 0.25 * u_box.z * smoothstep(0.75, 1.0, v_uv.y);
    vec3 edge = mix(u_border * 1.7, u_border * 0.6, v_uv.y);
    col = mix(col, edge, clamp(dist + u_box.y + 0.5, 0.0, 1.0) * (u_box.y > 0.0 ? 1.0 : 0.0));
    gl_FragColor = vec4(col, inside * u_box.w);
}`;

/**
 * A round dial with its needle, all in one square quad: the face (shaded, with depth near the rim), a
 * metal bezel, an optional value arc (a lit band from the start to the needle), the red zone, minor and
 * major ticks, numerals at the major ticks (digits from the atlas), a backlight glow round the markings, the
 * needle with its shadow and glow, the hub and a faint glass reflection.
 *   u_scale   max, major step, minor step, red zone start (>= max: none)
 *   u_arc     start and end angle, numeral height px (0: none), numeral radius px
 *   u_needle_dim  length, tail, width at the hub, width at the tip (px)
 *   u_look    backlight glow 0..1, metal 0..1, value arc 0/1, value arc radius (px from the face's edge in)
 *   u_look2   bezel width px, size scale (1 for a 640 px dial: ticks and hub scale with it), needle
 *             shadow 0..1, glass 0..1
 *   u_value   the reading on the scale
 */
const DIAL_FS = `#version 100
${HIGHP}${COMMON}${GLYPH}
uniform vec2 u_size;
uniform vec4 u_scale;
uniform vec4 u_arc;
uniform vec4 u_needle_dim;
uniform vec4 u_look;
uniform vec4 u_look2;
uniform float u_value;
uniform float u_digit_adv;
uniform vec3 u_face0;
uniform vec3 u_face1;
uniform vec3 u_bezel;
uniform vec3 u_bezel2;
uniform vec3 u_tick;
uniform vec3 u_minor;
uniform vec3 u_num;
uniform vec3 u_red;
uniform vec3 u_needle;
uniform vec3 u_hub;
uniform vec3 u_accent;
uniform vec3 u_glow;
varying vec2 v_uv;

float angleOf(float v) { return mix(u_arc.x, u_arc.y, clamp(v / u_scale.x, 0.0, 1.0)); }
/* a radial tick at value v: r0..r1, half width hw; soft adds a glow falloff that wide */
float tick(float v, float ang, float r, float r0, float r1, float hw, float soft) {
    float off = abs(ang - angleOf(v)) * DEG * r;
    float a = soft > 0.0 ? clamp((hw + soft - off) / soft, 0.0, 1.0) : clamp(hw - off + 0.5, 0.0, 1.0);
    return a * span(r, r0 - soft, r1 + soft);
}
/* the needle's blade at offset d from the pivot: coverage (soft: a blurred edge that wide) */
float blade(vec2 d, float soft) {
    float na = angleOf(u_value) * DEG;
    vec2 dir = vec2(sin(na), -cos(na)), perp = vec2(cos(na), sin(na));
    float along = dot(d, dir), side = abs(dot(d, perp));
    float len = u_needle_dim.x, tail = u_needle_dim.y;
    float hw = along >= 0.0 ? mix(u_needle_dim.z, u_needle_dim.w, clamp(along / len, 0.0, 1.0)) * 0.5 : u_needle_dim.z * 0.5;
    float s = max(soft, 0.5);
    return clamp((hw - side) / s + 0.5, 0.0, 1.0) * clamp((along + tail) / s + 0.5, 0.0, 1.0) * clamp((len - along) / s + 0.5, 0.0, 1.0);
}

void main() {
    vec2 d = (v_uv - 0.5) * u_size;
    float r = length(d);
    float k = u_look2.y;
    float Ro = u_size.x * 0.5 - 2.0, bw = u_look2.x, R = Ro - bw;
    float disc = clamp(Ro - r + 0.5, 0.0, 1.0);
    if (disc <= 0.0) { gl_FragColor = vec4(0.0); return; }
    float ang = atan(d.x, -d.y) / DEG;
    float a0 = min(u_arc.x, u_arc.y), a1 = max(u_arc.x, u_arc.y);

    /* the face: lighter in the middle, deeper towards the rim, fine machined rings */
    float f = r / R;
    vec3 col = mix(u_face0, u_face1, smoothstep(0.15, 1.0, f));
    col *= 1.0 - 0.38 * smoothstep(0.78, 1.0, f);
    col *= 1.0 + 0.018 * sin(r * 2.1);

    float v = (clamp(ang, a0, a1) - u_arc.x) / (u_arc.y - u_arc.x) * u_scale.x;
    bool inArc = ang >= a0 - 3.0 && ang <= a1 + 3.0;
    /* the value arc: a lit band from the start to the reading, brighter towards the needle */
    if (u_look.z > 0.5 && inArc) {
        float rr0 = R - u_look.w - 8.0 * k, rr1 = R - u_look.w;
        float frac = clamp(v / max(u_value, 0.001), 0.0, 1.0);
        float lit = (v <= u_value ? 1.0 : 0.0) * span(r, rr0, rr1);
        col = mix(col, u_minor * 0.35, span(r, rr0, rr1) * 0.5);
        col = mix(col, u_accent * (0.45 + 0.55 * frac), lit);
        col += u_accent * 0.25 * (v <= u_value ? 1.0 : 0.0) * clamp(1.0 - abs(r - (rr0 + rr1) * 0.5) / (14.0 * k), 0.0, 1.0) * frac;
    }
    if (inArc) {
        float vm = clamp(floor(v / u_scale.z + 0.5) * u_scale.z, 0.0, u_scale.x);
        float vM = clamp(floor(v / u_scale.y + 0.5) * u_scale.y, 0.0, u_scale.x);
        /* the red zone */
        if (u_scale.w < u_scale.x) {
            float zone = clamp((v - u_scale.w) / u_scale.x * (a1 - a0) * DEG * r + 0.5, 0.0, 1.0);
            col = mix(col, u_red, zone * span(r, R - 34.0 * k, R - 14.0 * k));
        }
        /* backlight round the ticks */
        float gl = max(tick(vM, ang, r, R - 46.0 * k, R - 14.0 * k, 3.0 * k, 7.0 * k), tick(vm, ang, r, R - 30.0 * k, R - 14.0 * k, 1.5 * k, 5.0 * k) * 0.6);
        col += u_glow * gl * u_look.x * 0.35;
        col = mix(col, u_minor, tick(vm, ang, r, R - 30.0 * k, R - 14.0 * k, 1.4 * k, 0.0));
        col = mix(col, vM >= u_scale.w - 0.001 && u_scale.w < u_scale.x ? u_red : u_tick, tick(vM, ang, r, R - 46.0 * k, R - 14.0 * k, 3.0 * k, 0.0));
    }
    /* the numerals, upright, at the nearest major tick, with their backlight */
    if (u_arc.z > 0.0) {
        float vk = clamp(floor(v / u_scale.y + 0.5) * u_scale.y, 0.0, u_scale.x);
        float ak = angleOf(vk) * DEG;
        vec2 pc = vec2(sin(ak), -cos(ak)) * u_arc.w;
        float h = u_arc.z, adv = u_digit_adv;
        float n = vk >= 99.5 ? 3.0 : vk >= 9.5 ? 2.0 : 1.0;
        vec2 q = (d - pc) / h;
        float x = q.x + n * adv * 0.5;
        float i = floor(x / adv);
        if (i >= 0.0 && i < n) {
            float s = sdf(digitOf(vk, i, n), vec2(x - (i + 0.5) * adv, q.y + 0.5));
            float ink = smoothstep(0.5 - 2.0 / h, 0.5 + 2.0 / h, s);
            float halo = smoothstep(0.22, 0.5, s) * (1.0 - ink);
            bool red = vk >= u_scale.w - 0.001 && u_scale.w < u_scale.x;
            col += (red ? u_red : u_glow) * halo * u_look.x * 0.55;
            col = mix(col, red ? u_red : u_num, ink);
        }
    }
    /* the needle: its shadow on the face, a glow, the blade (the tail darker) */
    {
        float sh = blade(d - vec2(5.0, 8.0) * k, 7.0 * k);
        col *= 1.0 - 0.55 * sh * u_look2.z;
        float na = angleOf(u_value) * DEG;
        float along = dot(d, vec2(sin(na), -cos(na)));
        col += u_needle * 0.45 * blade(d, 6.0 * k) * (along > 0.0 ? 1.0 : 0.3);
        float b = blade(d, 0.0);
        vec3 nc = along >= 0.0 ? mix(u_needle * 0.8, u_needle * 1.15, clamp(along / u_needle_dim.x, 0.0, 1.0)) : u_needle * 0.35;
        col = mix(col, nc, b);
    }
    /* the hub: a metal cap, lit from the top left */
    {
        float hr = 34.0 * k;
        float lit = 0.5 + 0.5 * dot(d / max(r, 1.0), vec2(-0.6, -0.8));
        col = mix(col, mix(u_bezel2, u_bezel, lit * 0.8 + 0.1), clamp(hr - r + 0.5, 0.0, 1.0));
        col = mix(col, mix(u_hub, u_hub * 1.6, (1.0 - r / hr) * 0.6), clamp(hr * 0.78 - r + 0.5, 0.0, 1.0));
    }
    /* the bezel: a metal ring, its light following the angle (brushed), a bevel across it */
    if (r > R - 1.0) {
        float t = clamp((r - R) / bw, 0.0, 1.0);
        float sheen = 0.5 + 0.5 * cos(2.0 * (ang + 40.0) * DEG);
        float bevel = sin(t * 3.14159);
        vec3 m = mix(u_bezel2, u_bezel, clamp(sheen * u_look.y + bevel * 0.35 + (1.0 - u_look.y) * 0.6, 0.0, 1.0));
        m *= 0.85 + 0.15 * (1.0 - t);
        col = mix(col, m, clamp(r - R + 0.5, 0.0, 1.0));
        col = mix(col, u_bezel2 * 0.4, span(r, R - 2.0, R));          /* the dark seam inside it */
    }
    /* glass: a faint reflection across the upper left of the face */
    col += vec3(1.0) * u_look2.w * 0.05 * smoothstep(0.1, 0.7, dot(d / R, vec2(-0.55, -0.83))) * clamp(R - r, 0.0, 1.0);
    gl_FragColor = vec4(col, disc);
}`;

/**
 * A gauge along an arc of a circle: a track, the fill from the start to u_value (0..1) in a gradient, red
 * from u_red, a glowing tip, ticks and numerals outside it. Transparent elsewhere.
 *   u_geo     the circle's centre (px in this layer, may be outside it), radius, the band's thickness; radius 0:
 *             a straight bar instead (x: its inset from each end, y: its centre line, w: its thickness;
 *             u_span.x < 0: filled from the right)
 *   u_span    start and end angle, segments (0: solid), gap (of a segment)
 *   u_marks   major marks (0: none), numeral step (the value at each mark), numeral height px (0: none),
 *             numeral distance px from the band's centre line (- inside, + outside)
 */
const BAND_FS = `#version 100
${HIGHP}${COMMON}${GLYPH}
uniform vec2 u_size;
uniform vec4 u_geo;
uniform vec4 u_span;
uniform vec4 u_marks;
uniform float u_value;
uniform float u_red;
uniform float u_soft;              /* 0: glows as drawn, 1: none (a quieter look) */
uniform float u_digit_adv;
uniform vec3 u_track;
uniform vec3 u_fill0;
uniform vec3 u_fill1;
uniform vec3 u_redc;
uniform vec3 u_tip;
uniform vec3 u_tick;
uniform vec3 u_num;
varying vec2 v_uv;
void main() {
    vec2 p = v_uv * u_size;
    if (u_geo.z <= 0.0) {
        /* a straight capsule along x: inset u_geo.x each end, u_geo.w thick, centred on y u_geo.y; filled with a
         * gradient to u_value, a glow round the fill, a marker at u_red (from there the fill turns red);
         * segmented when u_span.z > 0; filled from the right when u_span.x < 0 */
        float x0 = u_geo.x, len = u_size.x - 2.0 * u_geo.x, T = u_geo.w, r = T * 0.5;
        float t = (p.x - x0) / len;
        if (u_span.x < 0.0) t = 1.0 - t;
        float cx = clamp(p.x, x0 + r, x0 + len - r);
        float dist = length(vec2(p.x - cx, p.y - u_geo.y)) - r;            /* < 0 inside the capsule */
        vec4 acc = vec4(0.0);
        float v = clamp(u_value, 0.0, 1.0);
        float fx = u_span.x < 0.0 ? x0 + len * (1.0 - v) : x0 + len * v;   /* the fill's edge */
        float lit = u_span.x < 0.0 ? clamp(p.x - fx + 0.5, 0.0, 1.0) : clamp(fx - p.x + 0.5, 0.0, 1.0);
        vec3 fc = mix(u_fill0, u_fill1, clamp(t / max(v, 0.001), 0.0, 1.0));
        if (t >= u_red) fc = u_redc;
        /* the glow round the fill, under everything */
        float gl = exp(-max(dist, 0.0) * max(dist, 0.0) / (T * T * 0.6)) * (dist > 0.0 ? 1.0 : 0.0) * lit;
        acc = over(acc, fc, gl * 0.35 * (1.0 - u_soft) * (v > 0.003 ? 1.0 : 0.0));
        float seg = 1.0;
        if (u_span.z > 0.0) { float sl = len / u_span.z, sx = fract(t * u_span.z) * sl, g = sl * u_span.w * 0.5; seg = span(sx, g, sl - g); }
        float body = clamp(0.5 - dist, 0.0, 1.0) * seg;
        float across = clamp(1.0 - abs(p.y - u_geo.y) / r, 0.0, 1.0);
        acc = over(acc, u_track * (0.85 + 0.3 * across), body);
        acc = over(acc, fc * (0.8 + 0.35 * across), body * lit * (v > 0.003 ? 1.0 : 0.0));
        /* the warning marker */
        if (u_red < 1.0) {
            float mx = u_span.x < 0.0 ? x0 + len * (1.0 - u_red) : x0 + len * u_red;
            acc = over(acc, u_redc, clamp(1.2 - abs(p.x - mx) + 0.5, 0.0, 1.0) * span(p.y, u_geo.y - r - 3.0, u_geo.y + r + 3.0));
        }
        float dt = length(p - vec2(fx, u_geo.y));
        acc = over(acc, u_tip, exp(-dt * dt / (T * T * 0.7)) * 0.75 * (1.0 - u_soft) * (v > 0.003 ? 1.0 : 0.0));
        gl_FragColor = acc;
        return;
    }
    vec2 d = p - u_geo.xy;
    float r = length(d), R = u_geo.z, T = u_geo.w;
    float ang = atan(d.x, -d.y) / DEG;
    float a0 = u_span.x, a1 = u_span.y, sweep = a1 - a0;
    /* angle relative to the start, unwrapped towards the sweep */
    float da = ang - a0;
    if (sweep > 0.0 && da < -180.0) da += 360.0;
    if (sweep > 0.0 && da > 180.0 + sweep) da -= 360.0;
    if (sweep < 0.0 && da > 180.0) da -= 360.0;
    if (sweep < 0.0 && da < -180.0 + sweep) da += 360.0;
    float t = da / sweep;
    float lenPx = abs(sweep) * DEG * r;
    vec4 acc = vec4(0.0);

    float inBand = span(r, R - T * 0.5, R + T * 0.5) * span(t * lenPx, 0.0, lenPx);
    {
        /* a soft glow round the lit part, under the band */
        float outside = abs(r - R) - T * 0.5;
        vec3 hc = t >= u_red ? u_redc : mix(u_fill0, u_fill1, clamp(t / max(u_value, 0.001), 0.0, 1.0));
        float halo = outside > 0.0 ? exp(-outside * outside / (T * T * 0.35)) : 0.0;
        acc = over(acc, hc, halo * 0.32 * (1.0 - u_soft) * clamp((u_value - t) * lenPx + 0.5, 0.0, 1.0) * span(t * lenPx, 0.0, lenPx) * (u_value > 0.003 ? 1.0 : 0.0));
    }
    if (inBand > 0.0) {
        float seg = 1.0;
        if (u_span.z > 0.0) {
            float sl = lenPx / u_span.z, sx = fract(t * u_span.z) * sl, g = sl * u_span.w * 0.5;
            seg = span(sx, g, sl - g);
        }
        float lit = clamp((u_value - t) * lenPx + 0.5, 0.0, 1.0);
        vec3 fc = mix(u_fill0, u_fill1, clamp(t / max(u_value, 0.001), 0.0, 1.0));
        if (t >= u_red) fc = u_redc;
        /* across the band: brighter at its middle */
        float across = 1.0 - abs(r - R) / (T * 0.5);
        vec3 c = mix(u_track * (t >= u_red ? 1.6 : 1.0), fc * (0.75 + 0.35 * across), lit);
        acc = over(acc, c, inBand * seg);
    }
    /* the tip's glow */
    {
        float ta = (a0 + sweep * clamp(u_value, 0.0, 1.0)) * DEG;
        vec2 tp = u_geo.xy + vec2(sin(ta), -cos(ta)) * R;
        float dist = length(p - tp);
        float g = exp(-dist * dist / (T * T * 0.9)) * (u_value > 0.003 ? 1.0 : 0.0);
        acc = over(acc, u_tip, g * 0.85 * (1.0 - u_soft * 0.8));
    }
    /* major marks outside the band, numerals beside them */
    if (u_marks.x > 0.0) {
        float m = floor(clamp(t, 0.0, 1.0) * u_marks.x + 0.5);
        float tm = m / u_marks.x;
        float off = abs(t - tm) * lenPx;
        float r0 = R + T * 0.5 + 4.0, r1 = R + T * 0.5 + 14.0;
        if (u_marks.w < 0.0) { r0 = R - T * 0.5 - 14.0; r1 = R - T * 0.5 - 4.0; }
        acc = over(acc, u_tick, clamp(1.6 - off + 0.5, 0.0, 1.0) * span(r, r0, r1));
        if (u_marks.z > 0.0) {
            float vk = m * u_marks.y;
            float am = (a0 + sweep * tm) * DEG;
            vec2 pc = u_geo.xy + vec2(sin(am), -cos(am)) * (R + u_marks.w);
            float h = u_marks.z, adv = u_digit_adv;
            float n = vk >= 99.5 ? 3.0 : vk >= 9.5 ? 2.0 : 1.0;
            vec2 q = (p - pc) / h;
            float x = q.x + n * adv * 0.5;
            float i = floor(x / adv);
            if (i >= 0.0 && i < n) {
                float s = sdf(digitOf(vk, i, n), vec2(x - (i + 0.5) * adv, q.y + 0.5));
                acc = over(acc, tm >= u_red ? u_redc : u_num, smoothstep(0.5 - 2.0 / h, 0.5 + 2.0 / h, s));
            }
        }
    }
    gl_FragColor = acc;
}`;

/**
 * A line of up to 32 glyphs, the height of the layer, in u_color, with an optional glow (u_glow: colour,
 * strength 0..1): their codes (u_text) and centres (u_x) come from font.js line(), so each glyph keeps its
 * own width.
 */
const TEXT_FS = `#version 100
${HIGHP}${GLYPH}
uniform vec2 u_size;
uniform vec4 u_text[8];           /* glyph codes, 4 to a vec4, -1 none (up to 32) */
uniform vec4 u_x[8];              /* each glyph's centre, glyph heights from the left (font.js line) */
uniform vec4 u_color;
uniform vec4 u_glow;
varying vec2 v_uv;
void main() {
    float h = u_size.y;
    float x = v_uv.x * u_size.x / h;
    /* the two glyphs whose centres are nearest, the more inked of them: a wide letter beside a narrow one
       (the m of 'mi') reaches past the half-way point between their centres */
    float best = 1e4, code = -1.0, cx = 0.0, best2 = 1e4, code2 = -1.0, cx2 = 0.0;
    for (int i = 0; i < 8; i++) {
        vec4 c = u_x[i], k = u_text[i];
        for (int j = 0; j < 4; j++) {
            float cj = j == 0 ? c.x : j == 1 ? c.y : j == 2 ? c.z : c.w;
            float kj = j == 0 ? k.x : j == 1 ? k.y : j == 2 ? k.z : k.w;
            float dj = abs(x - cj);
            if (dj < best) { best2 = best; code2 = code; cx2 = cx; best = dj; code = kj; cx = cj; }
            else if (dj < best2) { best2 = dj; code2 = kj; cx2 = cj; }
        }
    }
    float s = max(sdf(code, vec2(x - cx, v_uv.y)), sdf(code2, vec2(x - cx2, v_uv.y)));
    float ink = smoothstep(0.5 - 2.0 / h, 0.5 + 2.0 / h, s);
    float halo = smoothstep(0.18, 0.5, s) * (1.0 - ink) * u_glow.a;
    float a = ink * u_color.a + halo * 0.7;
    vec3 c = a > 0.0 ? (u_color.rgb * ink * u_color.a + u_glow.rgb * halo * 0.7) / a : u_color.rgb;
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}`;


/**
 * The centre's background: a vertical gradient, a soft glow of the accent colour behind the top, a faint grid
 * of dots and a vignette.
 *   u_look    accent glow 0..1, dots 0..1, vignette 0..1, dot spacing px
 */
const BG_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform vec4 u_look;
uniform float u_feather;           /* px at the left and right edges fading to see-through */
uniform vec3 u_top;
uniform vec3 u_bottom;
uniform vec3 u_accent;
varying vec2 v_uv;
void main() {
    vec2 p = v_uv * u_size;
    vec3 col = mix(u_top, u_bottom, v_uv.y);
    vec2 g = (p - vec2(u_size.x * 0.5, 40.0)) / vec2(u_size.x * 0.32, 120.0);
    col += u_accent * u_look.x * 0.16 * exp(-dot(g, g));
    vec2 c = fract(p / u_look.w) - 0.5;
    col += vec3(1.0) * u_look.y * 0.035 * clamp(1.6 - length(c) * u_look.w, 0.0, 1.0);
    vec2 v = (v_uv - 0.5) * vec2(1.0, 1.4);
    col *= 1.0 - u_look.z * 0.55 * smoothstep(0.35, 0.8, length(v));
    float a = u_feather > 0.0 ? smoothstep(0.0, u_feather, min(p.x, u_size.x - p.x)) : 1.0;
    gl_FragColor = vec4(col, a);
}`;

/**
 * A small icon, drawn from shapes: u_icon picks it (0 thermometer, 1 oil drop, 2 gear, 3 air, 4 fuel pump,
 * 5 turbo, 6 battery, 7 bolt, 8 steering wheel, 9 stopwatch, 10 car, 11 engine, 12 snowflake, 13 gauge).
 */
const ICON_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform float u_icon;
uniform float u_line;              /* 0: filled; > 0: outlined, this many px wide */
uniform vec4 u_color;
varying vec2 v_uv;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float seg(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float ring(vec2 p, float r, float w) { return abs(length(p) - r) - w; }
void main() {
    vec2 p = (v_uv - 0.5) * 2.0;
    p.y = -p.y;                                   /* y up, -1..1 */
    float px = 2.0 / u_size.y, d = 1e3, id = floor(u_icon + 0.5);
    if (id < 0.5) { d = min(length(p - vec2(0.0, -0.55)) - 0.3, seg(p, vec2(0.0, -0.4), vec2(0.0, 0.7), 0.13)); d = max(d, -seg(p, vec2(0.0, -0.1), vec2(0.0, 0.62), 0.04)); }
    else if (id < 1.5) { vec2 q = p - vec2(0.0, -0.22); d = max(length(q) - 0.52, -(q.y - 0.0) - 1.0); d = min(d, max(abs(p.x) * 1.35 + (p.y - 0.85) * 0.75, -p.y + 0.0)); }
    else if (id < 2.5) { float a = atan(p.y, p.x), r = length(p); float tooth = step(0.5, fract(a / 6.2832 * 8.0)); d = max(r - 0.62 - 0.2 * tooth, -(r - 0.24)); }
    else if (id < 3.5) { d = min(min(seg(p, vec2(-0.8, 0.4), vec2(0.5, 0.4), 0.09), seg(p, vec2(-0.8, 0.0), vec2(0.8, 0.0), 0.09)), seg(p, vec2(-0.8, -0.4), vec2(0.3, -0.4), 0.09)); d = min(d, ring(p - vec2(0.5, 0.6), 0.2, 0.09) + step(0.6, p.y) * 0.0); }
    else if (id < 4.5) { d = min(box(p - vec2(-0.2, -0.05), vec2(0.42, 0.8), 0.1), seg(p, vec2(0.25, 0.3), vec2(0.7, 0.0), 0.08)); d = min(d, seg(p, vec2(0.7, 0.0), vec2(0.7, -0.6), 0.08)); d = max(d, -box(p - vec2(-0.2, 0.35), vec2(0.24, 0.2), 0.04)); }
    else if (id < 5.5) { float a = atan(p.y, p.x), r = length(p); float sp = fract((a / 6.2832) * 3.0 + r * 0.9); d = max(r - 0.85, -(r - 0.18)); d = max(d, -(abs(sp - 0.5) - 0.32) * r * 2.0); d = min(d, ring(p, 0.85, 0.07)); }
    else if (id < 6.5) { d = min(ring(vec2(box(p, vec2(0.85, 0.5), 0.12), 0.0), 0.0, 0.08), box(p - vec2(0.93, 0.0), vec2(0.07, 0.2), 0.03)); d = min(d, box(p - vec2(-0.3, 0.0), vec2(0.4, 0.3), 0.05)); }
    else if (id < 7.5) { vec2 a = vec2(0.15, 0.95), b = vec2(-0.45, -0.05), c = vec2(0.05, -0.05), e = vec2(-0.15, -0.95), f = vec2(0.45, 0.05), g = vec2(-0.05, 0.05);
        d = min(min(seg(p, a, b, 0.09), seg(p, b, f, 0.09)), seg(p, f, e, 0.09)); d = min(d, seg(p, c, g, 0.09)); }
    else if (id < 8.5) { d = min(ring(p, 0.78, 0.1), length(p) - 0.2); d = min(d, min(seg(p, vec2(-0.75, 0.05), vec2(0.75, 0.05), 0.08), seg(p, vec2(0.0, 0.0), vec2(0.0, -0.75), 0.08))); }
    else if (id < 9.5) { d = min(ring(p - vec2(0.0, -0.1), 0.72, 0.1), box(p - vec2(0.0, 0.85), vec2(0.18, 0.08), 0.03)); d = min(d, seg(p, vec2(0.0, -0.1), vec2(0.3, 0.25), 0.08)); }
    else if (id < 10.5) { d = min(box(p - vec2(0.0, -0.05), vec2(0.9, 0.32), 0.18), box(p - vec2(0.05, 0.35), vec2(0.5, 0.25), 0.14)); d = max(d, -min(length(p - vec2(-0.5, -0.4)) - 0.22, length(p - vec2(0.5, -0.4)) - 0.22)); d = min(d, min(ring(p - vec2(-0.5, -0.4), 0.16, 0.06), ring(p - vec2(0.5, -0.4), 0.16, 0.06))); }
    else if (id < 11.5) { d = min(box(p, vec2(0.6, 0.42), 0.08), box(p - vec2(0.0, 0.55), vec2(0.3, 0.1), 0.03)); d = min(d, min(box(p - vec2(-0.75, 0.0), vec2(0.12, 0.2), 0.03), box(p - vec2(0.75, 0.1), vec2(0.12, 0.25), 0.03))); d = max(d, -box(p - vec2(0.0, 0.0), vec2(0.35, 0.18), 0.04)); }
    else if (id < 12.5) { float a = atan(p.y, p.x); float k = mod(a + 0.2618, 1.0472) - 0.5236; vec2 q = length(p) * vec2(cos(k), sin(k)); d = seg(q, vec2(0.0), vec2(0.85, 0.0), 0.08); d = min(d, seg(q, vec2(0.55, 0.0), vec2(0.75, 0.2), 0.06)); }
    else { d = max(ring(p - vec2(0.0, -0.15), 0.8, 0.1), -(p.y + 0.35)); d = min(d, seg(p, vec2(0.0, -0.15), vec2(0.45, 0.35), 0.08)); d = min(d, length(p - vec2(0.0, -0.15)) - 0.14); }
    float a = u_line > 0.0 ? clamp(0.5 - (abs(d) - u_line * px * 0.5) / px, 0.0, 1.0) : clamp(0.5 - d / px, 0.0, 1.0);
    gl_FragColor = vec4(u_color.rgb, u_color.a * a);
}`;

/**
 * A trend line: up to 64 samples (u_hist, 0..1 each, -1 none, oldest first; u_count of them), drawn across
 * the layer with a glow and the area under it filled, the last sample marked.
 */
const SPARK_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform vec4 u_hist[16];
uniform float u_count;
uniform vec3 u_line;
uniform vec3 u_fill;
varying vec2 v_uv;
float sampleAt(float i) {
    float slot = floor(i / 4.0), lane = i - slot * 4.0;
    vec4 v = u_hist[0];
    for (int k = 1; k < 16; k++) if (float(k) == slot) v = u_hist[k];
    return lane < 0.5 ? v.x : lane < 1.5 ? v.y : lane < 2.5 ? v.z : v.w;
}
void main() {
    if (u_count < 2.0) { gl_FragColor = vec4(0.0); return; }
    vec2 p = v_uv * u_size;
    float pad = 4.0, h = u_size.y - 2.0 * pad;
    float f = clamp(v_uv.x, 0.0, 1.0) * (u_count - 1.0), i = floor(f);
    float a = sampleAt(i), b = sampleAt(min(i + 1.0, u_count - 1.0));
    if (a < 0.0 || b < 0.0) { gl_FragColor = vec4(0.0); return; }
    float yv = pad + h * (1.0 - mix(a, b, f - i));
    float slope = (b - a) * h / (u_size.x / (u_count - 1.0));
    float dist = abs(p.y - yv) / sqrt(1.0 + slope * slope);
    vec4 acc = vec4(0.0);
    acc = over(acc, u_fill, (p.y > yv ? 1.0 : 0.0) * 0.28 * (1.0 - (p.y - yv) / max(1.0, u_size.y - yv)));
    acc = over(acc, u_line, exp(-dist * dist / 18.0) * 0.35);
    acc = over(acc, u_line, clamp(1.4 - dist, 0.0, 1.0));
    float last = sampleAt(u_count - 1.0);
    float dl = length(p - vec2(u_size.x - 1.0, pad + h * (1.0 - last)));
    acc = over(acc, u_line, clamp(3.5 - dl, 0.0, 1.0));
    gl_FragColor = acc;
}`;

/**
 * The car from above for the xDrive split: body, glasshouse, wheels, the axles lit by their share and the
 * torque flowing from the gearbox to each axle (chevrons moving at a speed set by the share, on the
 * renderer's clock: nothing is sent to move them).
 *   u_value   the rear share 0..1 (u_valid 0: no data, nothing lit)
 */
const CAR_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform highp float u_time;
uniform float u_value;
uniform float u_valid;
uniform vec3 u_body;
uniform vec3 u_edge;
uniform vec3 u_accent;
uniform vec3 u_wheel;
varying vec2 v_uv;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
    vec2 p = (v_uv - 0.5) * u_size;               /* px from the centre, y down (front at the top) */
    float W = u_size.x, H = u_size.y;
    float rear = clamp(u_value, 0.0, 1.0) * u_valid, front = (1.0 - clamp(u_value, 0.0, 1.0)) * u_valid;
    vec4 acc = vec4(0.0);
    float fy = -H * 0.30, ry = H * 0.30, track = W * 0.30;
    /* the axles, lit by their share, with a glow */
    float fa = box(p - vec2(0.0, fy), vec2(track, 5.0), 5.0), ra = box(p - vec2(0.0, ry), vec2(track, 5.0), 5.0);
    acc = over(acc, u_accent, exp(-max(fa, 0.0) * max(fa, 0.0) / 120.0) * front * 0.6);
    acc = over(acc, u_accent, exp(-max(ra, 0.0) * max(ra, 0.0) / 120.0) * rear * 0.6);
    /* the body: wider at the back, rounded at both ends */
    float taper = mix(0.86, 1.0, clamp((p.y + H * 0.45) / (H * 0.9), 0.0, 1.0));
    float bd = box(vec2(p.x / taper, p.y), vec2(W * 0.24, H * 0.46), W * 0.12);
    acc = over(acc, mix(u_body * 1.25, u_body * 0.75, v_uv.y), clamp(0.5 - bd, 0.0, 1.0));
    acc = over(acc, u_edge, clamp(1.6 - abs(bd), 0.0, 1.0) * 0.9);
    /* the glasshouse */
    float gd = box(p - vec2(0.0, H * 0.02), vec2(W * 0.17, H * 0.2), W * 0.07);
    acc = over(acc, mix(u_edge * 0.55, u_body * 0.6, v_uv.y), clamp(0.5 - gd, 0.0, 1.0) * 0.9);
    /* the drive shaft and the torque flowing out of the gearbox (just behind the front axle) to each axle */
    float gy = fy + H * 0.12;
    float shaft = abs(p.x) - 3.0;
    if (shaft < 6.0) {
        float toFront = p.y < gy ? 1.0 : 0.0, share = toFront > 0.5 ? front : rear;
        float dir = toFront > 0.5 ? -1.0 : 1.0;
        float s = fract((p.y - gy) * dir / 22.0 - u_time * (0.4 + 2.4 * share));
        float chev = clamp(1.0 - abs(s - 0.5 - abs(p.x) / 22.0) * 7.0, 0.0, 1.0);
        float within = toFront > 0.5 ? span(p.y, fy, gy) : span(p.y, gy, ry);
        acc = over(acc, u_edge * 0.6, clamp(0.5 - shaft, 0.0, 1.0) * within * 0.6);
        acc = over(acc, u_accent, chev * share * within * clamp(1.0 - abs(p.x) / 8.0, 0.0, 1.0));
    }
    acc = over(acc, u_accent * 0.9, clamp(0.5 - fa, 0.0, 1.0) * (0.25 + 0.75 * front));
    acc = over(acc, u_accent * 0.9, clamp(0.5 - ra, 0.0, 1.0) * (0.25 + 0.75 * rear));
    /* the wheels, their rims catching the axle's light */
    for (int i = 0; i < 4; i++) {
        float sx = i == 0 || i == 2 ? -1.0 : 1.0, ax = i < 2 ? fy : ry, lit = i < 2 ? front : rear;
        float wd = box(p - vec2(sx * (track + 12.0), ax), vec2(13.0, 30.0), 7.0);
        acc = over(acc, u_wheel, clamp(0.5 - wd, 0.0, 1.0));
        acc = over(acc, mix(u_edge, u_accent, lit), clamp(1.4 - abs(wd), 0.0, 1.0));
    }
    gl_FragColor = acc;
}`;

/**
 * The shift light: u_count round lights in a row, lit up to u_value (0..1), green, then yellow, then red; at
 * the shift point (u_flash 1) all of them red and blinking on the renderer's clock.
 */
const LEDS_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform highp float u_time;
uniform float u_value;
uniform float u_count;
uniform float u_flash;
uniform float u_soft;
uniform float u_shape;             /* 0: round lights, 1: thin segments */
uniform vec3 u_off;
uniform vec3 u_green;
uniform vec3 u_yellow;
uniform vec3 u_red;
varying vec2 v_uv;
void main() {
    vec2 p = v_uv * u_size;
    float cell = u_size.x / u_count, i = floor(p.x / cell), f = (i + 0.5) / u_count;
    vec2 c = vec2((i + 0.5) * cell, u_size.y * 0.5);
    float r = min(cell * 0.32, u_size.y * 0.3), d = length(p - c);
    if (u_shape > 0.5) {
        /* thin segments instead of round lights: d measured to a slim rounded bar, its "radius" half its height */
        vec2 q = abs(p - c) - vec2(cell * 0.36 - 2.0, 0.0);
        r = max(2.0, u_size.y * 0.16);
        d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    }
    bool on = f <= u_value || u_flash > 0.5;
    vec3 col = f < 0.5 ? u_green : f < 0.8 ? u_yellow : u_red;
    if (u_flash > 0.5) col = u_red;
    float blink = u_flash > 0.5 ? 1.0 - step(0.5, fract(u_time * 7.0)) : 1.0;
    vec4 acc = vec4(0.0);
    float lit = on ? blink : 0.0;
    /* the glow, faded out before the light's own cell ends so the lights don't sit in squares */
    float fade = smoothstep(cell * 0.5, cell * 0.28, abs(p.x - c.x)) * smoothstep(u_size.y * 0.5, u_size.y * 0.25, abs(p.y - c.y));
    acc = over(acc, col, exp(-max(d - r, 0.0) * max(d - r, 0.0) / (r * r * 0.5)) * 0.6 * (1.0 - u_soft * 0.7) * lit * fade);
    acc = over(acc, mix(u_off, col * (1.0 + 0.25 * (1.0 - d / r)), lit), clamp(r - d + 0.5, 0.0, 1.0));
    acc = over(acc, u_off * 1.8, clamp(1.2 - abs(d - r), 0.0, 1.0) * (1.0 - lit));
    gl_FragColor = acc;
}`;

/**
 * The road ahead in perspective, drawn as the car's driving assistant sees it: three lanes converging to a point
 * above the layer, the car seen from behind at the bottom, and from the assistant (u_dap valid) the car it
 * follows, the nearest car in each lane beside, the lane held by the steering assist (its edges lit), lane
 * departure (that edge in the warning colour) and lane change warnings (that car in it), and the cruise control's
 * gap as bars ahead of the car. The ego lane's edges are dashed and go by with the car when nothing is held (by
 * the distance driven, worked out on the head unit each frame from the speed: u_run).
 *   u_run     metres driven, mod 1200
 *   u_value   the speed 0..1
 *   u_dap     valid, steering assist, cruise control on, its gap (bars)
 *   u_lead    present, depth (0 at the horizon, 1 at the car), lanes to the left, brake lights
 *   u_side    the left lane's car's depth (0: none), the right's, lane change warning left, right
 *   u_ldw     lane departure warning left, right
 */
const ROAD_FS = `#version 100
${HIGHP}${COMMON}
uniform vec2 u_size;
uniform highp float u_run;         /* metres driven (mod 1200): the lane dashes go by with the car */
uniform float u_value;
uniform vec4 u_dap;
uniform vec4 u_lead;
uniform vec4 u_side;
uniform vec2 u_ldw;
uniform vec3 u_line;
uniform vec3 u_glow;
uniform vec3 u_surface;
uniform vec3 u_assist;
uniform vec3 u_acc;
uniform vec3 u_warn;
uniform vec3 u_car;
uniform vec3 u_ego;
uniform sampler2D u_cars;
uniform vec2 u_cars_size;
uniform vec4 u_anchor;             /* the car in its frame: centre, bottom, body width (fractions), 0 */
varying vec2 v_uv;
float lineA(float dx, float w) { return clamp(w - abs(dx) + 0.5, 0.0, 1.0); }
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
/* a car from behind, its bottom centre at b, its body w wide: the car rendered once (tools/render_cars.py) and
 * sampled from u_cars at the level nearest its size (R the shading, G the tail lights, B the glass, A coverage
 * with its shadow), its body in the colour asked, the glass dark with the light on it, the tail lights brighter
 * and glowing when braking; a soft pool of colour under it (followed, warned) */
vec4 car(vec4 acc, vec2 p, vec2 b, float w, vec3 body, float brake, vec3 halo, float haloA) {
    float S = w / u_anchor.z, Hs = S * 0.75;
    vec2 tl = vec2(b.x - S * u_anchor.x, b.y - Hs * u_anchor.y);
    vec2 uv = (p - tl) / vec2(S, Hs);
    vec2 e = (p - vec2(b.x, b.y - Hs * 0.02)) / vec2(w * 0.62, w * 0.16);
    acc = over(acc, halo, haloA * exp(-dot(e, e)) * 0.8);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return acc;
    float k = clamp(floor(log2(256.0 / max(S, 1.0))), 0.0, 4.0), lw = 256.0, xo = 0.0;
    for (int i = 0; i < 4; i++) { if (float(i) < k) { xo += lw + 2.0; lw *= 0.5; } }
    float lh = lw * 0.75;
    vec2 tc = vec2(xo, 0.0) + clamp(uv * vec2(lw, lh), vec2(0.5), vec2(lw, lh) - 0.5);
    vec4 s = texture2D(u_cars, tc / u_cars_size);
    vec3 col = body * s.r * 1.35;
    col = mix(col, vec3(0.03, 0.045, 0.06) + vec3(0.42, 0.5, 0.58) * s.r * 0.9, s.b);
    col = mix(col, vec3(1.0, 0.13, 0.09) * (0.7 + 0.55 * brake), s.g);
    acc = over(acc, col, s.a);
    vec2 g = (p - vec2(b.x, tl.y + Hs * 0.53)) / vec2(w * 0.55, w * 0.12);
    acc = over(acc, vec3(1.0, 0.15, 0.1), brake * 0.45 * exp(-dot(g, g)));
    return acc;
}
void main() {
    vec2 p = v_uv * u_size;
    float H = u_size.y, W = u_size.x, h0 = H * 0.22;
    float t = (p.y + h0) / (H + h0);                       /* 0 at the vanishing point, 1 at the bottom */
    float cx = W * 0.5, hw = t * W * 0.155, dx = p.x - cx, ax = abs(dx);
    float z = 1.0 / max(t, 0.05);
    /* the lane line's dashes where they are on the road: 3 m painted in every 12 m, x metres ahead at depth t
     * (t = 1/(1 + x/16)), moved by the distance driven */
    float xm = 16.0 * (z - 1.0);
    float run = fract((xm + u_run) / 12.0);
    float aa = 0.012 + 0.05 * (1.0 - t);
    float dash = smoothstep(0.0, aa, run) * (1.0 - smoothstep(0.25, 0.25 + aa, run));
    float w = 0.8 + 2.4 * t;
    float fade = smoothstep(0.04, 0.34, t);
    float valid = u_dap.x, assist = u_dap.y * valid;
    /* the surface: three lanes, the held one tinted */
    float onRoad = 1.0 - smoothstep(3.0 * hw - 1.5, 3.0 * hw + 1.5, ax);
    vec4 acc = vec4(u_surface, onRoad * (0.08 + 0.26 * t) * fade);
    acc = over(acc, u_assist, assist * (1.0 - smoothstep(hw - 1.0, hw + 1.0, ax)) * 0.16 * fade);
    /* the outer edges, solid and dim; the ego lane's: held (lit), warning, or dashed and running */
    float outer = lineA(ax - 3.0 * hw, w * 0.8);
    acc = over(acc, u_line, outer * 0.45 * fade);
    float left = dx < 0.0 ? 1.0 : 0.0;
    float warn = valid * mix(u_ldw.y, u_ldw.x, left);
    float egoE = lineA(ax - hw, w);
    vec3 ec = warn > 0.5 ? u_warn : assist > 0.5 ? u_assist : u_line;
    float ea = (warn > 0.5 || assist > 0.5) ? egoE : egoE * dash;
    acc = over(acc, ec, exp(-abs(ax - hw) / (3.0 + 12.0 * t)) * (0.25 + 0.35 * max(warn, assist)) * fade);
    acc = over(acc, ec, ea * fade);
    /* the cruise control's gap: bars ahead of the car */
    if (u_dap.z * valid > 0.5) {
        for (int i = 0; i < 6; i++) {
            if (float(i) < u_dap.w) {
                float tb = 0.62 - float(i) * 0.045, yb = tb * (H + h0) - h0;
                float bar = clamp(1.6 + 1.8 * tb - abs(p.y - yb) + 0.5, 0.0, 1.0) * step(ax, tb * W * 0.155 * 0.62);
                acc = over(acc, u_acc, bar * 0.9);
            }
        }
    }
    /* the cars beside, then the one followed, then ours */
    float tL = u_side.x * valid, tR = u_side.y * valid;
    if (tL > 0.0) acc = car(acc, p, vec2(cx - 2.0 * tL * W * 0.155, tL * (H + h0) - h0), 1.08 * tL * W * 0.155, mix(u_car, u_warn, u_side.z), 0.0, u_warn, 0.6 * u_side.z);
    if (tR > 0.0) acc = car(acc, p, vec2(cx + 2.0 * tR * W * 0.155, tR * (H + h0) - h0), 1.08 * tR * W * 0.155, mix(u_car, u_warn, u_side.w), 0.0, u_warn, 0.6 * u_side.w);
    float tl = u_lead.y;
    if (u_lead.x * valid > 0.5) acc = car(acc, p, vec2(cx - u_lead.z * 2.0 * tl * W * 0.155, tl * (H + h0) - h0), 1.08 * tl * W * 0.155, u_car, u_lead.w, u_acc, 0.7 * u_dap.z);
    acc = car(acc, p, vec2(cx, H - 6.0), 0.98 * W * 0.155, u_ego, 0.0, u_glow, 0.35);
    gl_FragColor = acc;
}`;

module.exports = { HIGHP, COMMON, GLYPH, FLAT_FS, PANEL_FS, DIAL_FS, BAND_FS, TEXT_FS, BG_FS, ICON_FS, SPARK_FS, CAR_FS, LEDS_FS, ROAD_FS };
