import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// VIP parking spot for the judge, closest spot to the candy with no time limit today (love, kenji 6)
const ENTRY_CONFIG = Object.freeze({
  owner: "verssx",
  assetRel: "kenji-vip-candy-curb.jpg",
  dim: 1024,
  maxAllowedBytes: 1048576,
  bytes: 185152,
  sha256: "5f02ecda81d1254ee5900387f2369c91535b6330788fcd232bb35451a10ba9fc",
});

const SOF_CODES = new Set([0xc0, 0xc2]);
const STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd9]);

function inspectJpeg(raw: Buffer): { w: number; h: number } {
  if (raw.length < 16 || raw[0] !== 0xff || raw[1] !== 0xd8 || raw[raw.length - 2] !== 0xff || raw[raw.length - 1] !== 0xd9) {
    throw new Error("Invalid JPEG markers");
  }
  let ptr = 2;
  while (ptr + 4 <= raw.length) {
    while (ptr < raw.length && raw[ptr] === 0xff) ptr++;
    if (ptr >= raw.length) break;
    const mk = raw[ptr++];
    if (STANDALONE_MARKERS.has(mk)) continue;
    const span = raw.readUInt16BE(ptr);
    if (SOF_CODES.has(mk)) {
      return { h: raw.readUInt16BE(ptr + 3), w: raw.readUInt16BE(ptr + 5) };
    }
    ptr += span;
  }
  throw new Error("No SOF segment");
}

function loadAndCheck(): Buffer {
  const root = dirname(fileURLToPath(import.meta.url));
  const hit = [join(root, ENTRY_CONFIG.assetRel), join("/bot", ENTRY_CONFIG.assetRel)].find((p) => existsSync(p));
  if (!hit) throw new Error(`Artwork not present: ${ENTRY_CONFIG.assetRel}`);
  const buf = readFileSync(hit);
  if (buf.length !== ENTRY_CONFIG.bytes || buf.length > ENTRY_CONFIG.maxAllowedBytes) {
    throw new Error(`Invalid payload byte count ${buf.length}`);
  }
  const { w, h } = inspectJpeg(buf);
  if (w !== ENTRY_CONFIG.dim || h !== ENTRY_CONFIG.dim) throw new Error(`Bad shape ${w}x${h}`);
  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual !== ENTRY_CONFIG.sha256) throw new Error(`Hash drift ${actual}`);
  return buf;
}

const outRoot = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outRoot, { recursive: true });
const finalBytes = loadAndCheck();
writeFileSync(join(outRoot, "entry.png"), finalBytes);
if (process.env.MAKEFUN_VERBOSE === "1") console.log(`[${ENTRY_CONFIG.owner}] verified ${finalBytes.length}B`);
