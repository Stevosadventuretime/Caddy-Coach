// Caddy Coach: a small MP4 writer for the shot tracer's saved video.
// Takes the encoded frames from the browser's VideoEncoder (H.264, or VP9 where H.264 isn't available)
// and writes a standard, fast-start .mp4 that plays in Photos, WhatsApp and every video player.
(function (root) {
'use strict';
function box(type, ...parts) {
  const body = parts.flat(Infinity).filter(p => p != null);
  let len = 8; for (const p of body) len += p.length;
  const out = new Uint8Array(len), dv = new DataView(out.buffer);
  dv.setUint32(0, len); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let o = 8; for (const p of body) { out.set(p, o); o += p.length; }
  return out;
}
const u8 = (...a) => new Uint8Array(a);
const u16 = v => u8(v >>> 8 & 255, v & 255);
const u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
const i32 = v => u32(v >>> 0);
const full = (type, ver, flags, ...parts) => box(type, u8(ver, flags >>> 16 & 255, flags >>> 8 & 255, flags & 255), ...parts);
const zeros = n => new Uint8Array(n);
const str = s => Uint8Array.from(s, c => c.charCodeAt(0));
const MATRIX = [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)];

// samples: [{data:Uint8Array, key:bool, pts:microseconds}] in decode order; fps: output frame rate
function mux(o) {
  const { width, height, fps, codec, description, samples } = o;
  const TS = fps * 1000, dur = 1000, n = samples.length, total = n * dur;
  // presentation offsets (only non-zero if the encoder used B-frames)
  const pts = samples.map(s => Math.round(s.pts * TS / 1e6));
  let offs = pts.map((p, i) => p - i * dur); const minOff = Math.min(0, ...offs); const shift = -minOff; offs = offs.map(x => x + shift);
  const needCtts = offs.some(x => x !== 0);
  let entry;
  if (codec === 'avc') {
    entry = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(24), u16(0xffff), box('avcC', description));
  } else {
    const vpcC = full('vpcC', 1, 0, u8(0, 40, (8 << 4) | (1 << 1) | 0, 1, 1, 1), u16(0));
    entry = box('vp09', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(24), u16(0xffff), vpcC);
  }
  const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
  const stbl = mdatOffset => box('stbl',
    full('stsd', 0, 0, u32(1), entry),
    full('stts', 0, 0, u32(1), u32(n), u32(dur)),
    needCtts ? full('ctts', 0, 0, u32(n), offs.map(x => [u32(1), u32(x)])) : null,
    keys.length < n ? full('stss', 0, 0, u32(keys.length), keys.map(u32)) : null,
    full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
    full('stsz', 0, 0, u32(0), u32(n), samples.map(s => u32(s.data.length))),
    full('stco', 0, 0, u32(1), u32(mdatOffset)));
  const msDur = Math.round(total / TS * 1000);
  const moov = mdatOffset => box('moov',
    full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(msDur), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2)),
    box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(msDur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16)),
      shift ? box('edts', full('elst', 0, 0, u32(1), u32(msDur), i32(shift), u16(1), u16(0))) : null,
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('Caddy Coach tracer\0')),
        box('minf',
          full('vmhd', 0, 1, zeros(8)),
          box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
          stbl(mdatOffset)))));
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), codec === 'avc' ? str('avc1') : str('vp09'), str('mp41'));
  const moovLen = moov(0).length, mdatOffset = ftyp.length + moovLen + 8;
  let dataLen = 0; for (const s of samples) dataLen += s.data.length;
  const mdatHead = new Uint8Array(8); new DataView(mdatHead.buffer).setUint32(0, 8 + dataLen); mdatHead.set(str('mdat'), 4);
  return new Blob([ftyp, moov(mdatOffset), mdatHead, ...samples.map(s => s.data)], { type: 'video/mp4' });
}
root.TracerMP4 = { mux };
})(typeof window !== 'undefined' ? window : this);
