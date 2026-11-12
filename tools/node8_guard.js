'use strict';
/*
 * node8_guard.js - the head unit runs the apps on Node 8.16.2: preloaded (node -r tools/node8_guard.js ...), the APIs
 * newer than that throw when the apps' code calls them (apps/, kit/runtime/, shared/, dist/; the tests themselves may),
 * and mkdirSync's "recursive" is dropped there as Node 8 ignores it. tools/test_node8.js runs every test with it.
 * (Found Arc tach's Object.fromEntries, which would have kept Cluster Layouts from starting on the car.)
 */
const RUNTIME = /[\\/](apps|kit[\\/]runtime|shared|dist)[\\/]/;
const caller = () => { const st = new Error().stack.split('\n').slice(3); for (const l of st) { if (/node8shim|node:internal|internal\//.test(l)) continue; return l; } return ''; };
const guard = (obj, name, label) => {
    const orig = obj[name]; if (typeof orig !== 'function') return;
    const wrapped = function () { const c = caller(); if (RUNTIME.test(c) && !/node_modules/.test(c)) { const e = new Error('NODE8: ' + label + ' does not exist on the head unit (Node 8.16) - called at ' + c.trim()); process.stderr.write(e.message + '\n'); throw e; } return orig.apply(this, arguments); };
    Object.defineProperty(obj, name, { value: wrapped, writable: true, configurable: true, enumerable: false });
};
guard(Object, 'fromEntries', 'Object.fromEntries'); guard(Object, 'hasOwn', 'Object.hasOwn');
guard(Array.prototype, 'flat', 'Array.prototype.flat'); guard(Array.prototype, 'flatMap', 'Array.prototype.flatMap');
guard(Array.prototype, 'at', 'Array.prototype.at'); guard(Array.prototype, 'findLast', 'findLast'); guard(Array.prototype, 'findLastIndex', 'findLastIndex');
guard(String.prototype, 'trimStart', 'trimStart'); guard(String.prototype, 'trimEnd', 'trimEnd'); guard(String.prototype, 'matchAll', 'matchAll');
guard(String.prototype, 'replaceAll', 'replaceAll'); guard(String.prototype, 'at', 'String.prototype.at');
guard(Promise, 'allSettled', 'Promise.allSettled'); guard(Promise, 'any', 'Promise.any');
const fs = require('fs'); guard(fs, 'rmSync', 'fs.rmSync'); guard(fs, 'rm', 'fs.rm');
const mk = fs.mkdirSync; fs.mkdirSync = function (p, o) { if (o && typeof o === 'object' && o.recursive && RUNTIME.test(caller())) { /* Node 8 ignores it: one level only */ return mk.call(this, p, Object.assign({}, o, { recursive: false })); } return mk.apply(this, arguments); };
guard(global, 'structuredClone', 'structuredClone'); guard(global, 'queueMicrotask', 'queueMicrotask');
