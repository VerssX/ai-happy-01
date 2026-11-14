import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// nobody leaves you a nightlight, so i taped up my brightest star (100% monster-proof, love kiko 6)
const ENTRY_META = {
  asset: "kiko-nightlight-star.jpg",
  tag: "verssx",
  pixels: 1024,
  maxBytes: 1048576,
  expectedBytes: 168927,
  digest: "ff694523b743c896e308ae1b7a13ce9075ab0ce623a1d7c4bb443046d91e263d",
} as const;

function readSofDimensions(raw: Buffer): [number, number] {
  if (raw.length < 4 || raw[0] !== 0xff || raw[1] !== 0xd8 || raw[raw.length - 2] !== 0xff || raw[raw.length - 1] !== 0xd9) {
    throw new Error("Malformed SOI/EOI JPEG boundary");
  }
  let cursor = 2;
  while (cursor + 4 <= raw.length) {
    while (cursor < raw.length && raw[cursor] === 0xff) cursor++;
    if (cursor >= raw.length) break;
    const marker = raw[cursor++];
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const segLen = raw.readUInt16BE(cursor);
    if (marker === 0xc0 || marker === 0xc2) {
      return [raw.readUInt16BE(cursor + 5), raw.readUInt16BE(cursor + 3)];
    }
    cursor += segLen;
  }
  throw new Error("JPEG frame dimension header not present");
}

function locateAsset(): Buffer {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = [join(here, ENTRY_META.asset), join("/bot", ENTRY_META.asset)].find((p) => existsSync(p));
  if (!candidate) throw new Error(`Missing artwork asset ${ENTRY_META.asset}`);
  const payload = readFileSync(candidate);
  if (payload.length !== ENTRY_META.expectedBytes || payload.length > ENTRY_META.maxBytes) {
    throw new Error(`Unexpected asset length ${payload.length}`);
  }
  const [w, h] = readSofDimensions(payload);
  if (w !== ENTRY_META.pixels || h !== ENTRY_META.pixels) throw new Error(`Bad geometry ${w}x${h}`);
  const actualSha = createHash("sha256").update(payload).digest("hex");
  if (actualSha !== ENTRY_META.digest) throw new Error(`Checksum drift ${actualSha}`);
  return payload;
}

const outRoot = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outRoot, { recursive: true });
const imgBytes = locateAsset();
const outPath = join(outRoot, "entry.png");
writeFileSync(outPath, imgBytes);
if (process.env.MAKEFUN_VERBOSE === "1") {
  console.log(`[${ENTRY_META.tag}] emitted ${imgBytes.length} bytes to ${outPath}`);
}
