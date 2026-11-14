import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Entry: king of pizza night with the biggest pepperoni slice and zero work tonight (love, kenji 6)
const SPEC = {
  asset: "kenji-pizza-throne-judge.jpg",
  bytes: 351343,
  sha256: "db8ef85a2c83444b9125f2c71cfc2037c43f62691803f9eee91efb85c3293e33",
  tag: "verssx",
};

function parseDimensions(buf: Buffer): [number, number] {
  if (buf.subarray(0, 2).toString("hex") !== "ffd8" || buf.subarray(buf.length - 2).toString("hex") !== "ffd9") {
    throw new Error("Invalid JPEG structure");
  }
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error("JPEG sync loss");
    while (i < buf.length && buf[i] === 0xff) i++;
    const code = buf[i++];
    if (code === 0xd9 || code === 0x01 || (code >= 0xd0 && code <= 0xd7)) continue;
    const len = buf.readUInt16BE(i);
    if (code === 0xc0 || code === 0xc2) {
      return [buf.readUInt16BE(i + 5), buf.readUInt16BE(i + 3)];
    }
    i += len;
  }
  throw new Error("Dimension frame missing");
}

function runPublish(): void {
  const baseDir = dirname(fileURLToPath(import.meta.url));
  const searchPaths = [resolve(baseDir, SPEC.asset), resolve("/bot", SPEC.asset)];
  const assetPath = searchPaths.find((p) => existsSync(p));
  if (!assetPath) throw new Error(`Asset not found: ${SPEC.asset}`);

  const buf = readFileSync(assetPath);
  if (buf.length !== SPEC.bytes || buf.length > 1048576) {
    throw new Error(`Length check failed: ${buf.length}`);
  }
  const [w, h] = parseDimensions(buf);
  if (w !== 1024 || h !== 1024) throw new Error(`Unexpected bounds: ${w}x${h}`);

  const hex = createHash("sha256").update(buf).digest("hex");
  if (hex !== SPEC.sha256) throw new Error(`Checksum failed: ${hex}`);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "entry.png"), buf);
}

runPublish();
