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
  await page.goto("http://localhost:5173");
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
  await page.mouse.move(a.x, a.y);
  await page.mouse.wheel(0, -350);
  assert.ok(Number(await page.locator("#zoom").inputValue()) > 1);
  await page.mouse.down();
  await page.mouse.move(a.x + 22, a.y + 20, { steps: 6 });
  await page.mouse.up();
  assert.notEqual(Number(await page.locator("#pan-x").inputValue()), 0);
  const corner = pos(49, 73);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 30, corner.y - 30, { steps: 5 });
  await page.mouse.up();
  assert.ok(Number(await page.locator("#frame-width").inputValue()) < 1);
  assert.ok(Number(await page.locator("#frame-height").inputValue()) < 1);
  await page.locator("#drag-mode").selectOption("frame");
  await page.locator("#preview").scrollIntoViewIfNeeded();
  const movingRect = await page.locator("#preview").boundingBox();
  const movingPoint = {
    x: movingRect.x + movingRect.width * 0.25,
    y: movingRect.y + (movingRect.height * 35) / 148,
  };
  const beforeMove = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  await page.mouse.move(movingPoint.x, movingPoint.y);
  await page.mouse.down();
  await page.mouse.move(movingPoint.x + 20, movingPoint.y + 15, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(
    await page.locator("#preview").evaluate((c) => c.toDataURL()),
    beforeMove,
    "moving the frame changes the canvas",
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
    "PASS: selection, mouse pan, wheel zoom, corner resize, frame move/reset, per-photo dates show/hide, orange default, direct 2362×3496 JPEG, mobile layout",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
