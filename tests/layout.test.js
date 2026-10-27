import { test } from "node:test";
import assert from "node:assert/strict";
import {
  papers,
  layouts,
  size,
  cells,
  exifDate,
  jpegDensity,
} from "../layout.js";
test("300 DPI dimensions match physical paper", () => {
  assert.deepEqual(size("postcard", "portrait", 300), {
    w: 100,
    h: 148,
    pxW: 1181,
    pxH: 1748,
  });
  assert.equal(size("card", "landscape", 300).w, 86);
});
test("all layouts remain inside every supported paper and never overlap", () => {
  for (const paper of Object.keys(papers))
    for (const orientation of ["portrait", "landscape"])
      for (const layout of Object.keys(layouts)) {
        const { w, h } = size(paper, orientation, 300);
        const boxes = cells(layout, w, h, 12, 10);
        for (const [i, a] of boxes.entries()) {
          assert.ok(a.w > 0 && a.h > 0);
          assert.ok(
            a.x >= 12 &&
              a.y >= 12 &&
              a.x + a.w <= w - 12 + 0.001 &&
              a.y + a.h <= h - 12 + 0.001,
          );
          for (const b of boxes.slice(i + 1))
            assert.ok(
              a.x + a.w <= b.x + 0.001 ||
                b.x + b.w <= a.x + 0.001 ||
                a.y + a.h <= b.y + 0.001 ||
                b.y + b.h <= a.y + 0.001,
            );
        }
      }
});
test("malformed EXIF does not crash", () => {
  assert.equal(exifDate(new ArrayBuffer(0)), "");
  assert.equal(
    exifDate(new Uint8Array([255, 216, 255, 225, 0, 50]).buffer),
    "",
  );
});
test("reads JPEG EXIF shooting date in little endian TIFF", () => {
  const b = new ArrayBuffer(76),
    v = new DataView(b);
  v.setUint16(0, 0xffd8);
  v.setUint16(2, 0xffe1);
  v.setUint16(4, 72);
  v.setUint32(6, 0x45786966);
  const base = 12;
  v.setUint16(base, 0x4949);
  v.setUint16(base + 2, 42, true);
  v.setUint32(base + 4, 8, true);
  v.setUint16(base + 8, 1, true);
  v.setUint16(base + 10, 0x9003, true);
  v.setUint16(base + 12, 2, true);
  v.setUint32(base + 14, 20, true);
  v.setUint32(base + 18, 26, true);
  new Uint8Array(b, base + 26, 20).set(
    new TextEncoder().encode("2025:06:15 12:30:00\0"),
  );
  assert.equal(exifDate(b), "2025-06-15");
});

test("JPEG density is updated without touching compressed image data", () => {
  const original = new Uint8Array([
    255, 216, 255, 218, 0, 2, 10, 20, 30, 255, 217,
  ]);
  const encoded = jpegDensity(original, 600);
  assert.equal(encoded.length, original.length + 18);
  assert.equal(encoded[13], 1);
  assert.equal(new DataView(encoded.buffer).getUint16(14), 600);
  assert.equal(new DataView(encoded.buffer).getUint16(16), 600);
  assert.deepEqual(encoded.slice(20), original.slice(2));
  const changed = jpegDensity(encoded, 300);
  assert.equal(changed.length, encoded.length);
  assert.equal(new DataView(changed.buffer).getUint16(14), 300);
  assert.deepEqual(changed.slice(20), original.slice(2));
});
