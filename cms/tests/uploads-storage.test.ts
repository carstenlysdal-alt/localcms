import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { findUpload, getStorageConfig, isValidUploadName, saveUpload } from "../lib/media-storage";

const dir = mkdtempSync(path.join(tmpdir(), "cms-uploads-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("lagringsvalg: local som standard, volume via UPLOAD_DIR eller Railway Volume", () => {
  const local = getStorageConfig({} as NodeJS.ProcessEnv, "/proj");
  assert.deepEqual(local, { driver: "local", root: "/proj/public/uploads" });
  assert.deepEqual(getStorageConfig({ UPLOAD_DIR: "/data/uploads" } as unknown as NodeJS.ProcessEnv), { driver: "volume", root: "/data/uploads" });
  assert.deepEqual(getStorageConfig({ RAILWAY_VOLUME_MOUNT_PATH: "/data" } as unknown as NodeJS.ProcessEnv), { driver: "volume", root: "/data/uploads" });
  assert.equal(getStorageConfig({ UPLOAD_STORAGE: "local", UPLOAD_DIR: "/data/uploads" } as unknown as NodeJS.ProcessEnv, "/p").driver, "local");
  assert.throws(() => getStorageConfig({ UPLOAD_STORAGE: "volume" } as unknown as NodeJS.ProcessEnv), /UPLOAD_DIR/);
  assert.throws(() => getStorageConfig({ UPLOAD_STORAGE: "volume", UPLOAD_DIR: "relativ" } as unknown as NodeJS.ProcessEnv), /absolut/);
  assert.throws(() => getStorageConfig({ UPLOAD_STORAGE: "s3" } as unknown as NodeJS.ProcessEnv), /understøttes ikke/);
});

test("kun uuid-navne med hvidlistet endelse accepteres", () => {
  assert.equal(isValidUploadName(`${randomUUID()}.webp`), true);
  for (const bad of ["../etc/passwd", "a.webp", `${randomUUID()}.svg`, `${randomUUID()}.html`, `${randomUUID()}.webp/../x`, `.${randomUUID()}.webp`, `${randomUUID()}.WEBP`]) {
    assert.equal(isValidUploadName(bad), false, bad);
  }
});

test("gem og find upload på volume; overskriver aldrig; ukendt/ugyldigt -> null", async () => {
  const config = { driver: "volume" as const, root: path.join(dir, "uploads") };
  const name = `${randomUUID()}.png`;
  const saved = await saveUpload(name, Buffer.from("png-bytes"), config);
  assert.equal(saved.url, `/uploads/${name}`);
  const found = await findUpload(name, config);
  assert.equal(found?.size, 9);
  assert.equal(found?.contentType, "image/png");
  await assert.rejects(() => saveUpload(name, Buffer.from("x"), config));
  await assert.rejects(() => saveUpload("../x.png", Buffer.from("x"), config), /Ugyldigt/);
  assert.equal(await findUpload(`${randomUUID()}.png`, config), null);
  assert.equal(await findUpload("../../etc/passwd", config), null);
});

test("upload-ruten: content-type, nosniff, cache, range, 304 og 404", async () => {
  const root = path.join(dir, "route");
  const prev = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = root;
  try {
    const { GET, HEAD } = await import("../app/uploads/[name]/route");
    const name = `${randomUUID()}.mp4`;
    await saveUpload(name, Buffer.from("0123456789"), { driver: "volume", root });
    const ctx = (n: string) => ({ params: Promise.resolve({ name: n }) });

    const res = await GET(new Request(`http://x/uploads/${name}`), ctx(name));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "video/mp4");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("cache-control") ?? "", /immutable/);
    assert.equal(await res.text(), "0123456789");

    const part = await GET(new Request(`http://x/uploads/${name}`, { headers: { range: "bytes=2-4" } }), ctx(name));
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), "bytes 2-4/10");
    assert.equal(await part.text(), "234");

    const bad = await GET(new Request(`http://x/uploads/${name}`, { headers: { range: "bytes=50-60" } }), ctx(name));
    assert.equal(bad.status, 416);

    const etag = res.headers.get("etag")!;
    assert.equal((await GET(new Request(`http://x/uploads/${name}`, { headers: { "if-none-match": etag } }), ctx(name))).status, 304);
    assert.equal((await HEAD(new Request(`http://x/uploads/${name}`), ctx(name))).status, 200);

    const missing = await GET(new Request("http://x/uploads/nope"), ctx("nope"));
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await GET(new Request("http://x/uploads/x"), ctx("../../etc/passwd"))).status, 404);
  } finally {
    if (prev === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prev;
  }
});
