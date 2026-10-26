// Minimal TensorFlow Lite runtime in plain JavaScript (float models).
// Reads the .tflite flatbuffer and runs the ops BlazePose needs on Float32Arrays (NHWC).
(function (root) {
'use strict';

// ---------- flatbuffer reading ----------
function FB(buf) { this.b = new DataView(buf); this.u8 = new Uint8Array(buf); }
FB.prototype = {
  root() { return this.b.getUint32(0, true); },
  field(t, i) { // returns absolute offset of field i of table at t, or 0
    const vt = t - this.b.getInt32(t, true), vs = this.b.getUint16(vt, true);
    const o = 4 + i * 2; if (o >= vs) return 0;
    const f = this.b.getUint16(vt + o, true); return f ? t + f : 0;
  },
  ref(p) { return p + this.b.getUint32(p, true); },
  table(t, i) { const p = this.field(t, i); return p ? this.ref(p) : 0; },
  vec(t, i) { const p = this.field(t, i); if (!p) return null; const v = this.ref(p); return { n: this.b.getUint32(v, true), p: v + 4 }; },
  tables(t, i) { const v = this.vec(t, i); if (!v) return []; const r = []; for (let k = 0; k < v.n; k++) r.push(this.ref(v.p + 4 * k)); return r; },
  i32s(t, i) { const v = this.vec(t, i); if (!v) return []; const r = []; for (let k = 0; k < v.n; k++) r.push(this.b.getInt32(v.p + 4 * k, true)); return r; },
  f32s(t, i) { const v = this.vec(t, i); if (!v) return []; const r = []; for (let k = 0; k < v.n; k++) r.push(this.b.getFloat32(v.p + 4 * k, true)); return r; },
  bytes(t, i) { const v = this.vec(t, i); return v ? this.u8.subarray(v.p, v.p + v.n) : null; },
  str(t, i) { const v = this.vec(t, i); return v ? new TextDecoder().decode(this.u8.subarray(v.p, v.p + v.n)) : ''; },
  i8(t, i, d) { const p = this.field(t, i); return p ? this.b.getInt8(p) : d; },
  u8f(t, i, d) { const p = this.field(t, i); return p ? this.b.getUint8(p) : d; },
  i32(t, i, d) { const p = this.field(t, i); return p ? this.b.getInt32(p, true) : d; },
  f32(t, i, d) { const p = this.field(t, i); return p ? this.b.getFloat32(p, true) : d; },
  bool(t, i, d) { const p = this.field(t, i); return p ? !!this.b.getUint8(p) : d; },
};

function f16(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (m / 1024);
  if (e === 31) return m ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + m / 1024);
}

const OP = { 5: 'DEPTH_TO_SPACE', 124: 'DENSIFY', 0: 'ADD', 1: 'AVERAGE_POOL_2D', 2: 'CONCATENATION', 3: 'CONV_2D', 4: 'DEPTHWISE_CONV_2D', 6: 'DEQUANTIZE', 9: 'FULLY_CONNECTED', 14: 'LOGISTIC', 17: 'MAX_POOL_2D', 18: 'MUL', 19: 'RELU', 21: 'RELU6', 22: 'RESHAPE', 23: 'RESIZE_BILINEAR', 25: 'SOFTMAX', 28: 'TANH', 34: 'PAD', 39: 'TRANSPOSE', 40: 'MEAN', 41: 'SUB', 42: 'DIV', 45: 'STRIDED_SLICE', 54: 'PRELU', 55: 'MAXIMUM', 57: 'MINIMUM', 60: 'PADV2', 67: 'TRANSPOSE_CONV', 96: 'RESIZE_NEAREST_NEIGHBOR', 97: 'LEAKY_RELU', 116: 'HARD_SWISH' };

function densify(fb, sp, shape, values) {
  const trav = fb.i32s(sp, 0), blk = fb.i32s(sp, 1);
  if (blk.length || trav.some((v, i) => v !== i)) throw new Error('block sparsity not supported');
  const rd = (tab, ty) => { if (!tab) return null; const v = fb.vec(tab, 0); if (!v) return null; const r = new Int32Array(v.n);
    for (let k = 0; k < v.n; k++) r[k] = ty === 1 ? fb.b.getInt32(v.p + 4 * k, true) : ty === 2 ? fb.b.getUint16(v.p + 2 * k, true) : fb.b.getUint8(v.p + k); return r; };
  const dims = fb.tables(sp, 2).map(d => ({ fmt: fb.i8(d, 0, 0), size: fb.i32(d, 1, 0), seg: rd(fb.table(d, 3), fb.u8f(d, 2, 0)), idx: rd(fb.table(d, 5), fb.u8f(d, 4, 0)) }));
  const n = shape.reduce((a, b) => a * b, 1), out = new Float32Array(n), r = shape.length, coord = new Array(r).fill(0);
  const strides = []; let m = 1; for (let k = r - 1; k >= 0; k--) { strides[k] = m; m *= shape[k]; }
  (function rec(l, prefix) {
    if (l === r) { let f = 0; for (let k = 0; k < r; k++) f += coord[k] * strides[k]; out[f] = values[prefix]; return; }
    const d = dims[l];
    if (d.fmt === 0) for (let i = 0; i < d.size; i++) { coord[l] = i; rec(l + 1, prefix * d.size + i); }
    else for (let j = d.seg[prefix]; j < d.seg[prefix + 1]; j++) { coord[l] = d.idx[j]; rec(l + 1, j); }
  })(0, 0);
  return out;
}
function parse(buf) {
  const fb = new FB(buf), m = fb.root();
  const opcodes = fb.tables(m, 1).map(oc => {
    const dep = fb.i8(oc, 0, 0), code = fb.i32(oc, 3, 0);
    const c = Math.max(dep, code); return { code: c, name: OP[c] || ('OP_' + c), custom: fb.str(oc, 1) };
  });
  const buffers = fb.tables(m, 4).map(b => fb.bytes(b, 0));
  const sg = fb.tables(m, 2)[0];
  const tensors = fb.tables(sg, 0).map(t => {
    const shape = fb.i32s(t, 0), type = fb.i8(t, 1, 0), bi = fb.i32(t, 2, 0), name = fb.str(t, 3);
    const q = fb.table(t, 4);
    const quant = q ? { scale: fb.f32s(q, 2), zero: (() => { const v = fb.vec(q, 3); if (!v) return []; const r = []; for (let k = 0; k < v.n; k++) r.push(Number(fb.b.getBigInt64(v.p + 8 * k, true))); return r; })() } : null;
    const raw = buffers[bi];
    let data = null;
    if (raw && raw.length) {
      const al = raw.slice(); // copy for alignment
      if (type === 0) data = new Float32Array(al.buffer);
      else if (type === 1) { const h = new Uint16Array(al.buffer), f = new Float32Array(h.length); for (let k = 0; k < h.length; k++) f[k] = f16(h[k]); data = f; }
      else if (type === 2) data = new Int32Array(al.buffer);
      else if (type === 4) { const b = new BigInt64Array(al.buffer); data = Int32Array.from(b, x => Number(x)); }
      else if (type === 3) data = new Uint8Array(al.buffer);
      else if (type === 9) data = new Int8Array(al.buffer);
      else data = al;
    }
    const sp = fb.table(t, 6);
    if (sp && data) data = densify(fb, sp, shape, data);
    return { shape, type, name, data, quant };
  });
  const ops = fb.tables(sg, 3).map(o => {
    const oc = opcodes[fb.field(o, 0) ? fb.b.getUint32(fb.field(o, 0), true) : 0];
    const opt = fb.table(o, 4);
    return { name: oc.name, code: oc.code, inputs: fb.i32s(o, 1), outputs: fb.i32s(o, 2), opt, fb };
  });
  return { tensors, ops, inputs: fb.i32s(sg, 1), outputs: fb.i32s(sg, 2), fb };
}

// ---------- op options ----------
const ACT = (a, x) => a === 1 ? (x < 0 ? 0 : x) : a === 3 ? (x < 0 ? 0 : x > 6 ? 6 : x) : a === 2 ? (x < -1 ? -1 : x > 1 ? 1 : x) : a === 4 ? Math.tanh(x) : x;
function opts(op) {
  const f = op.fb, t = op.opt;
  if (!t) return {};
  switch (op.name) {
    case 'CONV_2D': return { pad: f.i8(t, 0, 0), sw: f.i32(t, 1, 1), sh: f.i32(t, 2, 1), act: f.i8(t, 3, 0), dw: f.i32(t, 4, 1), dh: f.i32(t, 5, 1) };
    case 'DEPTHWISE_CONV_2D': return { pad: f.i8(t, 0, 0), sw: f.i32(t, 1, 1), sh: f.i32(t, 2, 1), mult: f.i32(t, 3, 1), act: f.i8(t, 4, 0), dw: f.i32(t, 5, 1), dh: f.i32(t, 6, 1) };
    case 'MAX_POOL_2D': case 'AVERAGE_POOL_2D': return { pad: f.i8(t, 0, 0), sw: f.i32(t, 1, 1), sh: f.i32(t, 2, 1), fw: f.i32(t, 3, 1), fh: f.i32(t, 4, 1), act: f.i8(t, 5, 0) };
    case 'ADD': case 'MUL': case 'SUB': case 'DIV': return { act: f.i8(t, 0, 0) };
    case 'CONCATENATION': return { axis: f.i32(t, 0, 0), act: f.i8(t, 1, 0) };
    case 'RESHAPE': return { shape: f.i32s(t, 0) };
    case 'RESIZE_BILINEAR': return { align: f.bool(t, 2, false), half: f.bool(t, 3, false) };
    case 'RESIZE_NEAREST_NEIGHBOR': return { align: f.bool(t, 0, false), half: f.bool(t, 1, false) };
    case 'FULLY_CONNECTED': return { act: f.i8(t, 0, 0), keep: f.bool(t, 2, false) };
    case 'TRANSPOSE_CONV': return { pad: f.i8(t, 0, 0), sw: f.i32(t, 1, 1), sh: f.i32(t, 2, 1), act: f.i8(t, 3, 0) };
    case 'LEAKY_RELU': return { alpha: f.f32(t, 0, 0.2) };
    case 'DEPTH_TO_SPACE': return { bs: f.i32(t, 0, 2) };
    case 'MEAN': return { keep: f.bool(t, 0, false) };
    default: return {};
  }
}
function padAmt(inp, k, s, d, same) { // returns [out, padBefore]
  const ek = (k - 1) * d + 1;
  if (!same) return [Math.floor((inp - ek) / s) + 1, 0];
  const out = Math.ceil(inp / s), tot = Math.max(0, (out - 1) * s + ek - inp);
  return [out, Math.floor(tot / 2)];
}

// ---------- interpreter ----------
function Model(buf, wantOutputs) {
  const g = parse(buf);
  this.g = g;
  const T = g.tensors;
  // fold ops whose inputs are all constants (DENSIFY / DEQUANTIZE of weights)
  g.ops = g.ops.filter(op => {
    if (!(op.name === 'DEQUANTIZE' || op.name === 'DENSIFY')) return true;
    const src = T[op.inputs[0]]; if (!src.data) return true;
    const out = T[op.outputs[0]]; out.data = src.data instanceof Float32Array ? src.data : Float32Array.from(src.data); return false;
  });
  // prune to the ops that feed the requested outputs
  const outs = wantOutputs ? wantOutputs.map(i => g.outputs[i]) : g.outputs;
  const need = new Set(outs), keep = [];
  for (let k = g.ops.length - 1; k >= 0; k--) {
    const op = g.ops[k];
    if (op.outputs.some(o => need.has(o))) { keep.push(op); op.inputs.forEach(i => { if (i >= 0) need.add(i); }); }
  }
  keep.reverse();
  this.ops = keep.map(op => Object.assign(op, { o: opts(op) }));
  this.outIdx = outs;
  // pre-pack weights
  for (const op of this.ops) {
    if (op.name === 'CONV_2D') {
      const w = T[op.inputs[1]], [co, kh, kw, ci] = w.shape, src = w.data, dst = new Float32Array(src.length);
      for (let o = 0; o < co; o++) for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) for (let i = 0; i < ci; i++)
        dst[((y * kw + x) * ci + i) * co + o] = src[((o * kh + y) * kw + x) * ci + i];
      op.w = dst; op.k = [co, kh, kw, ci];
    }
    if (op.name === 'DEPTHWISE_CONV_2D') { op.w = T[op.inputs[1]].data; op.k = T[op.inputs[1]].shape; }
    if (op.name === 'TRANSPOSE_CONV') { op.w = T[op.inputs[1]].data; op.k = T[op.inputs[1]].shape; }
  }
  this.flops = 0;
}
Model.prototype.inputShape = function (i = 0) { return this.g.tensors[this.g.inputs[i]].shape; };
Model.prototype.run = function (inputs) {
  const T = this.g.tensors, val = new Map();
  this.g.inputs.forEach((ti, i) => val.set(ti, { d: inputs[i], s: T[ti].shape }));
  const get = i => { if (val.has(i)) return val.get(i); const t = T[i]; if (t.data) { const v = { d: t.data, s: t.shape }; val.set(i, v); return v; } throw new Error('missing tensor ' + i + ' ' + t.name); };
  for (const op of this.ops) {
    const r = exec(op, op.inputs.map(i => (i < 0 ? null : (op.name === 'CONV_2D' || op.name === 'DEPTHWISE_CONV_2D' || op.name === 'TRANSPOSE_CONV') && i === op.inputs[1] ? null : get(i))), T, op);
    op.outputs.forEach((o, k) => val.set(o, Array.isArray(r) ? r[k] : r));
  }
  return this.outIdx.map(i => val.get(i));
};

function size(s) { let n = 1; for (const x of s) n *= x; return n; }
function bcast(a, b, f, act) {
  const n = Math.max(a.d.length, b.d.length), out = new Float32Array(n);
  if (a.d.length === b.d.length) { for (let i = 0; i < n; i++) out[i] = ACT(act, f(a.d[i], b.d[i])); return { d: out, s: a.s.length >= b.s.length ? a.s : b.s }; }
  if (b.d.length === 1) { const y = b.d[0]; for (let i = 0; i < n; i++) out[i] = ACT(act, f(a.d[i], y)); return { d: out, s: a.s }; }
  if (a.d.length === 1) { const x = a.d[0]; for (let i = 0; i < n; i++) out[i] = ACT(act, f(x, b.d[i])); return { d: out, s: b.s }; }
  // general broadcast (right-aligned)
  const S = a.d.length >= b.d.length ? a.s : b.s, r = S.length;
  const as = Array(r - a.s.length).fill(1).concat(a.s), bs = Array(r - b.s.length).fill(1).concat(b.s);
  const st = (sh) => { const s = Array(r).fill(0); let m = 1; for (let k = r - 1; k >= 0; k--) { s[k] = sh[k] === 1 ? 0 : m; m *= sh[k]; } return s; };
  const sa = st(as), sb = st(bs), idx = Array(r).fill(0);
  for (let i = 0; i < n; i++) {
    let ia = 0, ib = 0; for (let k = 0; k < r; k++) { ia += idx[k] * sa[k]; ib += idx[k] * sb[k]; }
    out[i] = ACT(act, f(a.d[ia], b.d[ib]));
    for (let k = r - 1; k >= 0; k--) { if (++idx[k] < S[k]) break; idx[k] = 0; }
  }
  return { d: out, s: S };
}

function exec(op, I, T, self) {
  const o = op.o, outShape = T[op.outputs[0]].shape;
  switch (op.name) {
    case 'DENSIFY': return I[0];
    case 'DEPTH_TO_SPACE': {
      const x = I[0], [, H, W, C] = x.s, bs = o.bs || 2, OC = C / (bs * bs), out = new Float32Array(x.d.length);
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) for (let i = 0; i < bs; i++) for (let j = 0; j < bs; j++) {
        const ib = (y * W + xx) * C + (i * bs + j) * OC, ob = ((y * bs + i) * W * bs + xx * bs + j) * OC;
        for (let c = 0; c < OC; c++) out[ob + c] = x.d[ib + c];
      }
      return { d: out, s: [1, H * bs, W * bs, OC] };
    }
    case 'DEQUANTIZE': return { d: I[0].d instanceof Float32Array ? I[0].d : Float32Array.from(I[0].d), s: I[0].s };
    case 'CONV_2D': {
      const x = I[0], [N, H, W, C] = x.s, [co, kh, kw, ci] = op.k, w = op.w, b = I[2] ? I[2].d : null;
      const [OH, pt] = padAmt(H, kh, o.sh, o.dh, o.pad === 0), [OW, pl] = padAmt(W, kw, o.sw, o.dw, o.pad === 0);
      const out = new Float32Array(OH * OW * co), xd = x.d;
      if (kh === 1 && kw === 1 && o.sh === 1 && o.sw === 1) {
        // a 1x1 convolution is a matrix product: work on 4 pixels x 4 output channels at a time with the sums held in
        // local variables, so each input and weight is read once per block (the sums run over the inputs in the same
        // order as before, so the result is identical; it's about three times faster)
        const P = OH * OW, c4 = co - (co % 4), p4 = P - (P % 4);
        for (let p = 0; p < p4; p += 4) {
          const i0 = p * C, i1 = i0 + C, i2 = i1 + C, i3 = i2 + C, o0 = p * co, o1 = o0 + co, o2 = o1 + co, o3 = o2 + co;
          for (let c = 0; c < c4; c += 4) {
            let s00 = 0, s01 = 0, s02 = 0, s03 = 0, s10 = 0, s11 = 0, s12 = 0, s13 = 0, s20 = 0, s21 = 0, s22 = 0, s23 = 0, s30 = 0, s31 = 0, s32 = 0, s33 = 0;
            if (b) { s00 = s10 = s20 = s30 = b[c]; s01 = s11 = s21 = s31 = b[c + 1]; s02 = s12 = s22 = s32 = b[c + 2]; s03 = s13 = s23 = s33 = b[c + 3]; }
            for (let i = 0, wb = c; i < ci; i++, wb += co) {
              const w0 = w[wb], w1 = w[wb + 1], w2 = w[wb + 2], w3 = w[wb + 3], a0 = xd[i0 + i], a1 = xd[i1 + i], a2 = xd[i2 + i], a3 = xd[i3 + i];
              s00 += a0 * w0; s01 += a0 * w1; s02 += a0 * w2; s03 += a0 * w3;
              s10 += a1 * w0; s11 += a1 * w1; s12 += a1 * w2; s13 += a1 * w3;
              s20 += a2 * w0; s21 += a2 * w1; s22 += a2 * w2; s23 += a2 * w3;
              s30 += a3 * w0; s31 += a3 * w1; s32 += a3 * w2; s33 += a3 * w3;
            }
            out[o0 + c] = s00; out[o0 + c + 1] = s01; out[o0 + c + 2] = s02; out[o0 + c + 3] = s03;
            out[o1 + c] = s10; out[o1 + c + 1] = s11; out[o1 + c + 2] = s12; out[o1 + c + 3] = s13;
            out[o2 + c] = s20; out[o2 + c + 1] = s21; out[o2 + c + 2] = s22; out[o2 + c + 3] = s23;
            out[o3 + c] = s30; out[o3 + c + 1] = s31; out[o3 + c + 2] = s32; out[o3 + c + 3] = s33;
          }
          for (let c = c4; c < co; c++) for (let q = 0; q < 4; q++) { let sm = b ? b[c] : 0; const ib = (p + q) * C; for (let i = 0; i < ci; i++) sm += xd[ib + i] * w[i * co + c]; out[(p + q) * co + c] = sm; }
        }
        for (let p = p4; p < P; p++) {
          const ob = p * co, ib = p * C; if (b) for (let c = 0; c < co; c++) out[ob + c] = b[c];
          for (let i = 0; i < ci; i++) { const a = xd[ib + i]; if (a === 0) continue; const wb = i * co; for (let c = 0; c < co; c++) out[ob + c] += a * w[wb + c]; }
        }
      } else {
        const c4 = co - (co % 4);
        for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
          const ob = (oy * OW + ox) * co;
          // 4 output channels at a time, summed in local variables
          for (let c = 0; c < c4; c += 4) {
            let s0 = b ? b[c] : 0, s1 = b ? b[c + 1] : 0, s2 = b ? b[c + 2] : 0, s3 = b ? b[c + 3] : 0;
            for (let ky = 0; ky < kh; ky++) {
              const iy = oy * o.sh - pt + ky * o.dh; if (iy < 0 || iy >= H) continue;
              for (let kx = 0; kx < kw; kx++) {
                const ix = ox * o.sw - pl + kx * o.dw; if (ix < 0 || ix >= W) continue;
                const ib = (iy * W + ix) * C; let wb = (ky * kw + kx) * ci * co + c;
                for (let i = 0; i < ci; i++, wb += co) { const a = xd[ib + i]; s0 += a * w[wb]; s1 += a * w[wb + 1]; s2 += a * w[wb + 2]; s3 += a * w[wb + 3]; }
              }
            }
            out[ob + c] = s0; out[ob + c + 1] = s1; out[ob + c + 2] = s2; out[ob + c + 3] = s3;
          }
          if (c4 === co) continue;
          if (b) for (let c = c4; c < co; c++) out[ob + c] = b[c];
          for (let ky = 0; ky < kh; ky++) {
            const iy = oy * o.sh - pt + ky * o.dh; if (iy < 0 || iy >= H) continue;
            for (let kx = 0; kx < kw; kx++) {
              const ix = ox * o.sw - pl + kx * o.dw; if (ix < 0 || ix >= W) continue;
              const ib = (iy * W + ix) * C, wb0 = (ky * kw + kx) * ci;
              for (let i = 0; i < ci; i++) { const a = xd[ib + i]; if (a === 0) continue; const wb = (wb0 + i) * co; for (let c = c4; c < co; c++) out[ob + c] += a * w[wb + c]; }
            }
          }
        }
      }
      if (o.act) for (let i = 0; i < out.length; i++) out[i] = ACT(o.act, out[i]);
      return { d: out, s: [1, OH, OW, co] };
    }
    case 'DEPTHWISE_CONV_2D': {
      const x = I[0], [N, H, W, C] = x.s, [, kh, kw, CO] = op.k, w = op.w, b = I[2] ? I[2].d : null, m = CO / C;
      const [OH, pt] = padAmt(H, kh, o.sh, o.dh, o.pad === 0), [OW, pl] = padAmt(W, kw, o.sw, o.dw, o.pad === 0);
      const out = new Float32Array(OH * OW * CO), xd = x.d;
      // pixels whose whole window is inside the picture: sum the window for each channel in a local variable
      const nt = kh * kw, tx = new Int32Array(nt), tw = new Int32Array(nt);
      for (let ky = 0, t = 0; ky < kh; ky++) for (let kx = 0; kx < kw; kx++, t++) { tx[t] = (ky * o.dh * W + kx * o.dw) * C; tw[t] = (ky * kw + kx) * CO; }
      const inside = (oy, ox) => { const y0 = oy * o.sh - pt, x0 = ox * o.sw - pl; return y0 >= 0 && x0 >= 0 && y0 + (kh - 1) * o.dh < H && x0 + (kw - 1) * o.dw < W; };
      for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
        const ob = (oy * OW + ox) * CO;
        if (m === 1 && inside(oy, ox)) {
          const base = ((oy * o.sh - pt) * W + (ox * o.sw - pl)) * C;
          if (nt === 9) {
            const x0 = base + tx[0], x1 = base + tx[1], x2 = base + tx[2], x3 = base + tx[3], x4 = base + tx[4], x5 = base + tx[5], x6 = base + tx[6], x7 = base + tx[7], x8 = base + tx[8];
            const w0 = tw[0], w1 = tw[1], w2 = tw[2], w3 = tw[3], w4 = tw[4], w5 = tw[5], w6 = tw[6], w7 = tw[7], w8 = tw[8];
            for (let c = 0; c < C; c++) out[ob + c] = (b ? b[c] : 0) + xd[x0 + c] * w[w0 + c] + xd[x1 + c] * w[w1 + c] + xd[x2 + c] * w[w2 + c] + xd[x3 + c] * w[w3 + c] + xd[x4 + c] * w[w4 + c] + xd[x5 + c] * w[w5 + c] + xd[x6 + c] * w[w6 + c] + xd[x7 + c] * w[w7 + c] + xd[x8 + c] * w[w8 + c];
          } else for (let c = 0; c < C; c++) { let sm = b ? b[c] : 0; for (let t = 0; t < nt; t++) sm += xd[base + tx[t] + c] * w[tw[t] + c]; out[ob + c] = sm; }
          continue;
        }
        if (b) for (let c = 0; c < CO; c++) out[ob + c] = b[c];
        for (let ky = 0; ky < kh; ky++) {
          const iy = oy * o.sh - pt + ky * o.dh; if (iy < 0 || iy >= H) continue;
          for (let kx = 0; kx < kw; kx++) {
            const ix = ox * o.sw - pl + kx * o.dw; if (ix < 0 || ix >= W) continue;
            const ib = (iy * W + ix) * C, wb = (ky * kw + kx) * CO;
            if (m === 1) for (let c = 0; c < C; c++) out[ob + c] += xd[ib + c] * w[wb + c];
            else for (let c = 0; c < C; c++) for (let j = 0; j < m; j++) out[ob + c * m + j] += xd[ib + c] * w[wb + c * m + j];
          }
        }
      }
      if (o.act) for (let i = 0; i < out.length; i++) out[i] = ACT(o.act, out[i]);
      return { d: out, s: [1, OH, OW, CO] };
    }
    case 'MAX_POOL_2D': case 'AVERAGE_POOL_2D': {
      const x = I[0], [N, H, W, C] = x.s, mx = op.name === 'MAX_POOL_2D';
      const [OH, pt] = padAmt(H, o.fh, o.sh, 1, o.pad === 0), [OW, pl] = padAmt(W, o.fw, o.sw, 1, o.pad === 0);
      const out = new Float32Array(OH * OW * C);
      for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) for (let c = 0; c < C; c++) {
        let acc = mx ? -Infinity : 0, n = 0;
        for (let ky = 0; ky < o.fh; ky++) { const iy = oy * o.sh - pt + ky; if (iy < 0 || iy >= H) continue;
          for (let kx = 0; kx < o.fw; kx++) { const ix = ox * o.sw - pl + kx; if (ix < 0 || ix >= W) continue;
            const v = x.d[(iy * W + ix) * C + c]; if (mx) { if (v > acc) acc = v; } else acc += v; n++; } }
        out[(oy * OW + ox) * C + c] = ACT(o.act, mx ? acc : acc / n);
      }
      return { d: out, s: [1, OH, OW, C] };
    }
    case 'ADD': return bcast(I[0], I[1], (a, b) => a + b, o.act);
    case 'SUB': return bcast(I[0], I[1], (a, b) => a - b, o.act);
    case 'MUL': return bcast(I[0], I[1], (a, b) => a * b, o.act);
    case 'DIV': return bcast(I[0], I[1], (a, b) => a / b, o.act);
    case 'MAXIMUM': return bcast(I[0], I[1], (a, b) => a > b ? a : b, 0);
    case 'MINIMUM': return bcast(I[0], I[1], (a, b) => a < b ? a : b, 0);
    case 'RELU': return { d: I[0].d.map(v => v < 0 ? 0 : v), s: I[0].s };
    case 'RELU6': return { d: I[0].d.map(v => v < 0 ? 0 : v > 6 ? 6 : v), s: I[0].s };
    case 'LOGISTIC': return { d: I[0].d.map(v => 1 / (1 + Math.exp(-v))), s: I[0].s };
    case 'TANH': return { d: I[0].d.map(Math.tanh), s: I[0].s };
    case 'HARD_SWISH': return { d: I[0].d.map(v => v * Math.min(6, Math.max(0, v + 3)) / 6), s: I[0].s };
    case 'LEAKY_RELU': return { d: I[0].d.map(v => v < 0 ? v * o.alpha : v), s: I[0].s };
    case 'PRELU': return bcast(I[0], I[1], (a, al) => a < 0 ? a * al : a, 0);
    case 'RESHAPE': {
      let s = (I[1] && I[1].d && I[1].d.length) ? Array.from(I[1].d) : (o.shape && o.shape.length ? o.shape.slice() : outShape.slice());
      const n = I[0].d.length, k = s.indexOf(-1); if (k >= 0) s[k] = n / size(s.filter((_, j) => j !== k));
      return { d: I[0].d, s };
    }
    case 'CONCATENATION': {
      const r = I[0].s.length, ax = o.axis < 0 ? o.axis + r : o.axis;
      const outer = size(I[0].s.slice(0, ax)), parts = I.map(t => size(t.s.slice(ax))), tot = parts.reduce((a, b) => a + b, 0);
      const out = new Float32Array(outer * tot);
      for (let q = 0; q < outer; q++) { let off = 0; I.forEach((t, j) => { out.set(t.d.subarray ? t.d.subarray(q * parts[j], (q + 1) * parts[j]) : t.d.slice(q * parts[j], (q + 1) * parts[j]), q * tot + off); off += parts[j]; }); }
      const s = I[0].s.slice(); s[ax] = I.reduce((a, t) => a + t.s[ax], 0);
      if (o.act) for (let i = 0; i < out.length; i++) out[i] = ACT(o.act, out[i]);
      return { d: out, s };
    }
    case 'PAD': case 'PADV2': {
      const x = I[0], p = I[1].d, r = x.s.length, cv = op.name === 'PADV2' && I[2] ? I[2].d[0] : 0;
      const s = x.s.map((d, k) => d + p[2 * k] + p[2 * k + 1]);
      const out = new Float32Array(size(s)); if (cv) out.fill(cv);
      if (r === 4) {
        const [, H, W, C] = x.s, [, OH, OW, OC] = s;
        for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
          const ib = (y * W + xx) * C, ob = ((y + p[2]) * OW + xx + p[4]) * OC + p[6];
          for (let c = 0; c < C; c++) out[ob + c] = x.d[ib + c];
        }
      } else throw new Error('PAD rank ' + r);
      return { d: out, s };
    }
    case 'RESIZE_BILINEAR': case 'RESIZE_NEAREST_NEIGHBOR': {
      const x = I[0], [, H, W, C] = x.s, sz = I[1].d, OH = sz[0], OW = sz[1], out = new Float32Array(OH * OW * C);
      const sy = o.align && OH > 1 ? (H - 1) / (OH - 1) : H / OH, sx = o.align && OW > 1 ? (W - 1) / (OW - 1) : W / OW;
      for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
        const ob = (oy * OW + ox) * C;
        if (op.name === 'RESIZE_NEAREST_NEIGHBOR') {
          const fy = o.half ? (oy + .5) * sy : oy * sy, fx = o.half ? (ox + .5) * sx : ox * sx;
          const iy = Math.min(H - 1, o.align ? Math.round(fy) : Math.floor(fy)), ix = Math.min(W - 1, o.align ? Math.round(fx) : Math.floor(fx));
          for (let c = 0; c < C; c++) out[ob + c] = x.d[(iy * W + ix) * C + c];
        } else {
          let fy = o.half ? (oy + .5) * sy - .5 : oy * sy, fx = o.half ? (ox + .5) * sx - .5 : ox * sx;
          const y0 = Math.max(0, Math.floor(fy)), x0 = Math.max(0, Math.floor(fx)), y1 = Math.min(H - 1, y0 + 1), x1 = Math.min(W - 1, x0 + 1);
          const dy = Math.max(0, fy - y0), dx = Math.max(0, fx - x0);
          for (let c = 0; c < C; c++) {
            const a = x.d[(y0 * W + x0) * C + c], b = x.d[(y0 * W + x1) * C + c], cc = x.d[(y1 * W + x0) * C + c], d = x.d[(y1 * W + x1) * C + c];
            out[ob + c] = a + (b - a) * dx + (cc - a) * dy + (a - b - cc + d) * dx * dy;
          }
        }
      }
      return { d: out, s: [1, OH, OW, C] };
    }
    case 'TRANSPOSE_CONV': { // inputs: output_shape, weights(O,H,W,I), input, [bias]
      const os = Array.from(I[0].d), x = I[2], [, H, W, C] = x.s, [co, kh, kw, ci] = op.k, w = op.w, b = I[3] ? I[3].d : null;
      const [, OH, OW] = os; const out = new Float32Array(OH * OW * co);
      const pt = o.pad === 0 ? Math.max(0, Math.floor(((H - 1) * o.sh + kh - OH) / 2)) : 0, pl = o.pad === 0 ? Math.max(0, Math.floor(((W - 1) * o.sw + kw - OW) / 2)) : 0;
      for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) for (let ky = 0; ky < kh; ky++) {
        const oy = iy * o.sh + ky - pt; if (oy < 0 || oy >= OH) continue;
        for (let kx = 0; kx < kw; kx++) { const ox = ix * o.sw + kx - pl; if (ox < 0 || ox >= OW) continue;
          for (let c = 0; c < co; c++) { let acc = 0; const wb = ((c * kh + ky) * kw + kx) * ci, ib = (iy * W + ix) * C; for (let i = 0; i < ci; i++) acc += x.d[ib + i] * w[wb + i]; out[(oy * OW + ox) * co + c] += acc; } }
      }
      if (b) for (let p = 0; p < OH * OW; p++) for (let c = 0; c < co; c++) out[p * co + c] += b[c];
      return { d: out, s: [1, OH, OW, co] };
    }
    case 'FULLY_CONNECTED': {
      const x = I[0], w = I[1], b = I[2] ? I[2].d : null, [U, K] = w.s, rows = x.d.length / K, out = new Float32Array(rows * U);
      for (let r = 0; r < rows; r++) for (let u = 0; u < U; u++) { let acc = b ? b[u] : 0; const wb = u * K, xb = r * K; for (let k = 0; k < K; k++) acc += x.d[xb + k] * w.d[wb + k]; out[r * U + u] = ACT(o.act, acc); }
      return { d: out, s: o.keep ? x.s.slice(0, -1).concat([U]) : [rows, U] };
    }
    case 'MEAN': {
      const x = I[0], axes = Array.from(I[1].d).map(a => a < 0 ? a + x.s.length : a);
      if (x.s.length === 4 && axes.length === 2 && axes.includes(1) && axes.includes(2)) {
        const [, H, W, C] = x.s, out = new Float32Array(C);
        for (let p = 0; p < H * W; p++) for (let c = 0; c < C; c++) out[c] += x.d[p * C + c];
        for (let c = 0; c < C; c++) out[c] /= H * W; return { d: out, s: o.keep ? [1, 1, 1, C] : [1, C] };
      }
      throw new Error('MEAN axes ' + axes);
    }
    default: throw new Error('Unsupported op ' + op.name);
  }
}

const api = { parse, Model };
if (typeof module !== 'undefined') module.exports = api; else root.TFLite = api;
})(this);
