import { copyFile, mkdir, cp, rm } from "node:fs/promises";
const vendorOnly = process.argv.includes("--vendor-only");
const target = vendorOnly ? "vendor" : "public/vendor";
if (!vendorOnly) await rm("public", { recursive: true, force: true });
await mkdir(target, { recursive: true });
await copyFile(
  "node_modules/fabric/dist/index.min.mjs",
  `${target}/fabric.mjs`,
);
await copyFile("node_modules/fabric/LICENSE", `${target}/fabric.LICENSE`);
if (!vendorOnly) {
  for (const name of [
    "index.html",
    "style.css",
    "app.js",
    "layout.js",
    "renderer.js",
  ])
    await cp(name, `public/${name}`);
}
