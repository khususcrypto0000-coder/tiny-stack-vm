// Tiny stack VM for make.fun tiny-stack-vm-01-run-20261122: a faithful
// interpreter of the kit ISA (32-bit wrap, 256 stack, 64 calls, 256 memory
// words, all ten traps with their own exit codes, step/output limits).
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table: one char per opcode byte (0x00..0x53); charCode-33 packs
// imm + 5*pops + 25*pushes. A space (charCode 32) means "no such opcode".
const T = '!;>&X]v{        DDDDDDD?DDD?DDD DDD             #((#!           ?+              &&:&';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function run(p, q) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  let s = 0, c = 0, ip = 0, pc = 0, t = 0, o = '';
  const e = x => [o, x];
  for (;;) {
    if (t === 1e6) return e(10);
    if (pc < 0 || pc >= n) return e(9);
    const op = p[pc];
    const v = op > 83 ? -1 : T.charCodeAt(op) - 33;
    if (v < 0) return e(5);
    const im = v % 5, po = ((v / 5) | 0) % 5, pu = (v / 25) | 0;
    if (pc + im >= n) return e(9);
    t++;
    const nx = pc + 1 + im;
    if (s < po) return e(2);
    if (s - po + pu > 256) return e(3);
    pc = nx;
    switch (op) {
      case 0: return e(0);
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[s++] = p[nx - 4] | p[nx - 3] << 8 | p[nx - 2] << 16 | p[nx - 1] << 24; break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const x = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = x; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: {
        const r = ((p[nx - 2] | p[nx - 1] << 8) << 16) >> 16;
        let take = true;
        if (op !== 48) { const x = D[--s]; take = op === 49 ? x === 0 : x !== 0; }
        if (take) pc = nx + r;
        break;
      }
      case 51: if (c === 64) return e(7); C[c++] = nx; pc = p[nx - 2] | p[nx - 1] << 8; break;
      case 52: if (!c) return e(8); pc = C[--c]; break;
      case 64: { const a = D[s - 1]; if (a < 0 || a > 255) return e(6); D[s - 1] = M[a]; break; }
      case 65: { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a > 255) return e(6); s -= 2; M[a] = v; break; }
      case 80: { const g = String(D[s - 1]); if (o.length + g.length > 65536) return e(11); s--; o += g; break; }
      case 81: if (o.length + 1 > 65536) return e(11); o += String.fromCharCode(D[--s] & 255); break;
      case 82: D[s++] = ip < q.length ? q[ip++] : -1; break;
      case 83: return e(D[--s] & 255);
      default: {
        const b = D[s - 1], a = D[s - 2];
        if (b === 0 && op >= 19 && op <= 22) return e(4);
        const r = op === 16 ? a + b | 0 : op === 17 ? a - b | 0 : op === 18 ? Math.imul(a, b)
          : op === 19 ? a === -2147483648 && b === -1 ? a : (a / b) | 0
          : op === 20 ? b === -1 ? 0 : a % b | 0
          : op === 21 ? Math.floor((a >>> 0) / (b >>> 0)) | 0
          : op === 22 ? (a >>> 0) % (b >>> 0) | 0
          : op === 24 ? a & b : op === 25 ? a | b : op === 26 ? a ^ b
          : op === 28 ? a << (b & 31) : op === 29 ? a >> (b & 31)
          : op === 30 ? (a >>> (b & 31)) | 0 : op === 32 ? a === b ? 1 : 0
          : op === 33 ? a < b ? 1 : 0 : (a >>> 0) < (b >>> 0) ? 1 : 0;
        s -= 2; D[s++] = r;
        break;
      }
    }
  }
}

for (const d of readdirSync(I).sort()) {
  const [o, x] = run(readFileSync(join(I, d, 'program.bin')), readFileSync(join(I, d, 'input.bin')));
  mkdirSync(join(O, d), { recursive: true });
  writeFileSync(join(O, d, 'stdout.bin'), Buffer.from(o, 'latin1'));
  writeFileSync(join(O, d, 'exit.txt'), x + '\n');
}
