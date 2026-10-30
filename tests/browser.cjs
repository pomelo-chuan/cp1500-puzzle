const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.APP_URL || "http://localhost:5173");
  assert.equal(await page.locator(".privacy").count(), 0);
  assert.equal(await page.locator("#date-color").inputValue(), "#ff943d");
  assert.equal(await page.locator("#dpi").inputValue(), "600");
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 1200;
    const x = c.getContext("2d");
    x.fillStyle = "#3a6386";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#ead4b0";
    x.fillRect(600, 0, 600, 1200);
    return c.toDataURL().split(",")[1];
  });
  await page.locator("#files").setInputFiles(
    [1, 2].map((i) => ({
      name: `photo-${i}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    })),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".photo").length === 2,
  );
  await page.locator("#global-date").fill("2026-10-27");
  await page.locator("#dates").check();
  await page.locator("#preview").scrollIntoViewIfNeeded();
  const rect = await page.locator("#preview").boundingBox();
  const pos = (x, y) => ({
    x: rect.x + (x / 100) * rect.width,
    y: rect.y + (y / 148) * rect.height,
  });
  const a = pos(25, 35);
  await page.mouse.click(a.x, a.y);
  assert.match(
    await page.locator(".photo.selected .name").textContent(),
    /photo-1/,
  );
  const beforeDrag = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 15, { steps: 8 });
  await page.mouse.up();
  assert.equal(
    await page.locator("#preview").evaluate((c) => c.toDataURL()),
    beforeDrag,
    "dragging does not edit the image",
  );
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 150);
  await page.waitForFunction((y) => window.scrollY > y, scrollBefore);
  assert.equal(
    await page.locator("#zoom").inputValue(),
    "1",
    "wheel scrolls the page instead of zooming",
  );
  await page.getByRole("button", { name: "增大照片缩放", exact: true }).click();
  assert.equal(await page.locator("#zoom").inputValue(), "1.1");
  await page
    .getByRole("button", { name: "增大裁切水平偏移", exact: true })
    .click();
  assert.equal(await page.locator("#pan-x").inputValue(), "0.05");
  await page
    .getByRole("button", { name: "减小相框宽度比例", exact: true })
    .click();
  await page
    .getByRole("button", { name: "减小相框高度比例", exact: true })
    .click();
  assert.equal(await page.locator("#frame-width").inputValue(), "0.95");
  assert.equal(await page.locator("#frame-height").inputValue(), "0.95");
  const beforeMove = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  await page.getByRole("button", { name: "相框右移", exact: true }).click();
  assert.notEqual(
    await page.locator("#preview").evaluate((c) => c.toDataURL()),
    beforeMove,
  );
  await page.locator("#reset-frame").click();
  assert.equal(await page.locator("#frame-width").inputValue(), "1");
  await page.locator("#photo-date").fill("2024-01-02");
  await page.locator("#photo-date-mode").selectOption("hide");
  assert.match(
    await page.locator(".photo.selected small").textContent(),
    /隐藏/,
  );
  await page.locator(".photo").nth(1).click();
  assert.equal(await page.locator("#photo-date-mode").inputValue(), "inherit");
  await page.locator("#dates").uncheck();
  await page.locator("#photo-date-mode").selectOption("show");
  await page.locator("#photo-date").fill("2025-06-15");
  const orange = await page.evaluate(() => {
    const c = document.querySelector("#preview"),
      { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (
        data[i] > 220 &&
        data[i + 1] > 95 &&
        data[i + 1] < 180 &&
        data[i + 2] < 100
      )
        n++;
    return n;
  });
  assert.ok(orange > 0, "individual date visible while global dates disabled");
  await page.locator("#photo-date-mode").selectOption("hide");
  const noOrange = await page.evaluate(() => {
    const c = document.querySelector("#preview"),
      { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (
        data[i] > 220 &&
        data[i + 1] > 95 &&
        data[i + 1] < 180 &&
        data[i + 2] < 100
      )
        n++;
    return n;
  });
  assert.equal(noOrange, 0);
  await page.locator("#zoom").fill("1.5");
  assert.equal(await page.locator("#zoom").inputValue(), "1.5");
  await page.locator("#rotate").click();
  await page.locator("#reset").click();
  assert.equal(await page.locator("#zoom").inputValue(), "1");
  const dp = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await dp;
  assert.match(download.suggestedFilename(), /600dpi\.jpg$/);
  await download.saveAs("/tmp/selphy-hd.jpg");
  const bytes = require("fs").readFileSync("/tmp/selphy-hd.jpg");
  assert.equal(bytes[0], 255);
  assert.equal(bytes[1], 216);
  assert.equal(bytes[13], 1);
  assert.equal(bytes.readUInt16BE(14), 600);
  assert.equal(bytes.readUInt16BE(16), 600);
  const dims = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + data;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, bytes.toString("base64"));
  assert.deepEqual(dims, [2362, 3496]);
  const fabricChecks = await page.evaluate(async () => {
    const { PhotoRenderer } = await import("./renderer.js");
    const source = document.createElement("canvas");
    source.width = 400;
    source.height = 200;
    const ctx = source.getContext("2d");
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect((i % 2) * 200, Math.floor(i / 2) * 100, 200, 100);
    });
    const img = new Image();
    img.src = source.toDataURL();
    await img.decode();
    const photo = { img, rotation: 0, zoom: 1, x: 0, y: 0 };
    const renderer = new PhotoRenderer(document.createElement("canvas"));
    const options = {
      dim: { w: 100, h: 148, pxW: 2362, pxH: 3496 },
      boxes: [
        { x: 4, y: 4, w: 92, h: 140 },
        { x: 0, y: 0, w: 2, h: 2 },
      ],
      photos: [photo],
      selected: 0,
      background: "#ffffff",
      polaroid: false,
      effect: "none",
      dates: [""],
      dateColor: "#ff943d",
      safe: true,
    };
    const sample = (canvas, x, y) =>
      Array.from(
        canvas.getContext("2d").getImageData(Math.floor(x), Math.floor(y), 1, 1)
          .data,
      ).slice(0, 3);
    const rotations = [];
    for (const rotation of [0, 90, 180, 270]) {
      photo.rotation = rotation;
      renderer.update(options);
      rotations.push(
        [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
        ].map(([x, y]) =>
          sample(
            renderer.canvas.lowerCanvasEl,
            (4 + 92 * x) * 10,
            (4 + 140 * y) * 10,
          ),
        ),
      );
    }
    const node = renderer.nodes.get(photo).image;
    photo.zoom = 2;
    photo.x = 1;
    photo.y = -1;
    renderer.update(options);
    const reused = node === renderer.nodes.get(photo).image;
    const cropped = sample(renderer.canvas.lowerCanvasEl, 500, 740);
    options.effect = "mono";
    renderer.update(options);
    const mono = sample(renderer.canvas.lowerCanvasEl, 500, 740);
    options.effect = "warm";
    renderer.update(options);
    const warm = sample(renderer.canvas.lowerCanvasEl, 500, 740);
    options.effect = "none";
    photo.rotation = 0;
    photo.zoom = 1;
    photo.x = photo.y = 0;
    renderer.update(options);
    const output = renderer.exportCanvas();
    const result = {
      rotations,
      reused,
      cropped,
      mono,
      warm,
      size: [output.width, output.height],
      placeholder: sample(output, 10, 10),
      guide: sample(
        output,
        (3 / 100) * output.width,
        (20 / 148) * output.height,
      ),
    };
    await renderer.canvas.dispose();
    return result;
  });
  const red = [255, 0, 0],
    green = [0, 255, 0],
    blue = [0, 0, 255],
    yellow = [255, 255, 0];
  assert.deepEqual(fabricChecks.rotations, [
    [red, green, blue, yellow],
    [blue, red, yellow, green],
    [yellow, blue, green, red],
    [green, yellow, red, blue],
  ]);
  assert.equal(fabricChecks.reused, true, "Fabric image object survives edits");
  assert.equal(fabricChecks.mono[0], fabricChecks.mono[1]);
  assert.equal(fabricChecks.mono[1], fabricChecks.mono[2]);
  assert.notDeepEqual(fabricChecks.warm, fabricChecks.cropped);
  assert.deepEqual(fabricChecks.size, [2362, 3496]);
  assert.deepEqual(
    fabricChecks.placeholder,
    [255, 255, 255],
    "empty slots are preview-only",
  );
  assert.deepEqual(
    fabricChecks.guide,
    [255, 255, 255],
    "safe guide is preview-only",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "/tmp/selphy-new-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: click selection, no drag/wheel editing, step buttons, frame position/reset, per-photo dates show/hide, orange default, direct 2362×3496 JPEG, mobile layout",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
