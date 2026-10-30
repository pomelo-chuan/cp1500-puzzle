import { layouts, size, cells, exifDate, jpegDensity } from "./layout.js";
const $ = (id) => document.getElementById(id),
  photos = [];
let selected = -1,
  layout = "four",
  timer;
function toast(s) {
  $("toast").textContent = s;
  $("toast").style.display = "block";
  clearTimeout(timer);
  timer = setTimeout(() => ($("toast").style.display = "none"), 4500);
}
function dimensions() {
  return size($("paper").value, $("orientation").value, Number($("dpi").value));
}
for (const [key, item] of Object.entries(layouts)) {
  const b = document.createElement("button");
  b.className = "layout";
  b.dataset.layout = key;
  b.title = item.name;
  const rects = cells(key, 40, 32, 1, 2)
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="1"/>`,
    )
    .join("");
  b.innerHTML = `<svg viewBox="0 0 40 32" aria-hidden="true">${rects}</svg>${item.name}`;
  b.onclick = () => {
    layout = key;
    render();
    syncEditor();
  };
  $("layouts").append(b);
}
function dateText(p) {
  if (p.dateMode === "hide" || (p.dateMode !== "show" && !$("dates").checked))
    return "";
  const raw = p.date || $("global-date").value || p.exif;
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  return $("date-format").value === "cn"
    ? `${y}年${m}月${d}日`
    : $("date-format").value === "dots"
      ? `${y}.${m}.${d}`
      : raw;
}
function paint(canvas, preview = false) {
  const dim = dimensions(),
    scale = preview ? Math.min(1200 / dim.pxW, 1500 / dim.pxH, 1) : 1;
  canvas.width = Math.round(dim.pxW * scale);
  canvas.height = Math.round(dim.pxH * scale);
  if (preview) {
    canvas.style.width = `min(100%, ${((window.innerWidth <= 650 ? 480 : 600) * dim.w) / dim.h}px)`;
  }
  const ctx = canvas.getContext("2d");
  const sx = canvas.width / dim.w,
    sy = canvas.height / dim.h;
  ctx.scale(sx, sy);
  ctx.fillStyle = $("background").value;
  ctx.fillRect(0, 0, dim.w, dim.h);
  const boxes = frameBoxes();
  for (let i = 0; i < boxes.length; i++) {
    const r = boxes[i],
      p = photos[i];
    if (!p) {
      if (!preview) continue;
      ctx.fillStyle = "#f0f1ea";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#bac2b0";
      ctx.font = `${Math.min(r.w, r.h) * 0.17}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + r.h / 2 + 2);
      continue;
    }
    const bottom = $("polaroid").checked ? Math.min(9, r.h * 0.22) : 0;
    const ih = r.h - bottom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, ih);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(r.x, r.y, r.w, ih);
    const rotated = p.rotation % 180 !== 0,
      iw = rotated ? p.img.naturalHeight : p.img.naturalWidth,
      hh = rotated ? p.img.naturalWidth : p.img.naturalHeight;
    const factor = Math.max(r.w / iw, ih / hh) * p.zoom,
      dw = iw * factor,
      dh = hh * factor;
    ctx.translate(
      r.x + r.w / 2 - (p.x * (dw - r.w)) / 2,
      r.y + ih / 2 - (p.y * (dh - ih)) / 2,
    );
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.filter =
      $("effect").value === "mono"
        ? "grayscale(1)"
        : $("effect").value === "warm"
          ? "sepia(.28) saturate(.85) contrast(1.04)"
          : "none";
    ctx.drawImage(
      p.img,
      (-p.img.naturalWidth * factor) / 2,
      (-p.img.naturalHeight * factor) / 2,
      p.img.naturalWidth * factor,
      p.img.naturalHeight * factor,
    );
    ctx.restore();
    {
      const date = dateText(p);
      if (date) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        ctx.font = `${Math.max(1.4, Math.min(2.5, r.w / 14))}px monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = $("date-color").value;
        if (!bottom) {
          ctx.shadowColor = "#000b";
          ctx.shadowBlur = 2 * sx;
        }
        if (bottom && $("date-color").value === "#ffffff")
          ctx.fillStyle = "#3e463b";
        ctx.fillText(
          date,
          r.x + r.w - 2,
          r.y + (bottom ? ih + bottom / 2 : ih - 3),
          r.w - 4,
        );
        ctx.restore();
      }
    }
  }
  if (preview && $("safe").checked) {
    ctx.save();
    ctx.strokeStyle = "#889c7c99";
    ctx.lineWidth = 0.15;
    ctx.setLineDash([1, 1]);
    ctx.strokeRect(3, 3, dim.w - 6, dim.h - 6);
    ctx.restore();
  }
  if (preview) drawSelection(ctx, boxes);
  return boxes.length;
}
function render() {
  const d = dimensions(),
    capacity = paint($("preview"), true);
  $("dimensions").textContent = `${d.w} × ${d.h} mm · ${$("dpi").value} DPI`;
  $("summary").textContent =
    `${d.pxW} × ${d.pxH} px · 已放入 ${Math.min(photos.length, capacity)} / ${capacity} 张`;
  $("empty").hidden = photos.length > 0;
  $("count").textContent = photos.length;
  $("margin-value").textContent = `${$("margin").value} mm`;
  $("gap-value").textContent = `${$("gap").value} mm`;
  document.querySelectorAll(".layout").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === layout);
    b.setAttribute("aria-pressed", b.dataset.layout === layout);
  });
  $("paper-note").textContent = {
    postcard: "RP / KP 系列常用照片纸",
    l: "L 尺寸耗材供应因地区而异",
    card: "需 PCC-CP400 卡片纸匣与 KC 系列耗材",
    square: "KC-18IS 贴纸区域，非整张卡片尺寸",
  }[$("paper").value];
}
function syncEditor() {
  const p = photos[selected];
  $("editor").hidden = !p;
  if (!p) return;
  $("photo-date").value = p.date;
  $("photo-date").placeholder = p.exif || "";
  $("photo-date-mode").value = p.dateMode || "inherit";
  const base = baseBoxes()[selected],
    frame = frameBoxes()[selected],
    dim = dimensions();
  if (base) {
    $("frame-width").max = Math.max(2, dim.w / base.w);
    $("frame-height").max = Math.max(2, dim.h / base.h);
    $("frame-width").min = Math.ceil(Math.min(0.3, 6 / base.w) * 100) / 100;
    $("frame-height").min = Math.ceil(Math.min(0.3, 6 / base.h) * 100) / 100;
    $("frame-width").value = frame.w / base.w;
    $("frame-height").value = frame.h / base.h;
  }
  $("zoom").value = p.zoom;
  $("pan-x").value = p.x;
  $("pan-y").value = p.y;
}
function list() {
  const host = $("photos");
  host.replaceChildren();
  photos.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "photo" + (i === selected ? " selected" : "");
    const img = document.createElement("img");
    img.src = p.url;
    img.alt = p.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = p.name;
    const small = document.createElement("small");
    small.textContent = `${i + 1} · ${p.dateMode === "hide" ? "日期已隐藏" : p.date || $("global-date").value || p.exif || "未设置日期"}`;
    meta.append(name, small);
    row.append(img, meta);
    for (const [label, title, action] of [
      ["↑", "前移", () => move(i, -1)],
      ["↓", "后移", () => move(i, 1)],
      [
        "×",
        "删除",
        () => {
          URL.revokeObjectURL(p.url);
          photos.splice(i, 1);
          selected = Math.min(selected, photos.length - 1);
          list();
          render();
        },
      ],
    ]) {
      const b = document.createElement("button");
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", `${title} ${p.name}`);
      b.onclick = (e) => {
        e.stopPropagation();
        action();
      };
      row.append(b);
    }
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `调整 ${p.name}`);
    row.onclick = () => {
      selected = i;
      list();
      render();
    };
    row.onkeydown = (e) => {
      if (e.target !== row) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selected = i;
        list();
        render();
      }
    };
    host.append(row);
  });
  syncEditor();
}
function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= photos.length) return;
  [photos[i], photos[j]] = [photos[j], photos[i]];
  selected = j;
  list();
  render();
}
async function addFiles(files) {
  for (const f of files) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      toast(`不支持 ${f.name}，请转为 JPG、PNG 或 WebP`);
      continue;
    }
    if (photos.length >= 50) {
      toast("最多添加 50 张照片");
      break;
    }
    if (f.size > 40 * 1024 * 1024) {
      toast(`${f.name} 超过 40 MB，请先压缩`);
      continue;
    }
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const exif =
        f.type === "image/jpeg" ? exifDate(await f.arrayBuffer()) : "";
      photos.push({
        img,
        url,
        name: f.name,
        date: "",
        dateMode: "inherit",
        exif,
        zoom: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    } catch {
      URL.revokeObjectURL(url);
      toast(`无法读取 ${f.name}`);
    }
  }
  selected = photos.length ? photos.length - 1 : -1;
  list();
  render();
  $("files").value = "";
}
$("files").onchange = (e) => addFiles(e.target.files);
for (const id of ["add", "add-center"])
  $(id).onclick = () => $("files").click();
document.addEventListener("dragover", (e) => {
  e.preventDefault();
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
for (const id of [
  "paper",
  "orientation",
  "dpi",
  "margin",
  "gap",
  "background",
  "effect",
  "polaroid",
  "safe",
  "dates",
  "date-format",
  "date-color",
  "global-date",
])
  $(id).addEventListener("input", () => {
    render();
    if (["paper", "orientation", "margin", "gap"].includes(id)) syncEditor();
  });
for (const [id, key] of [
  ["zoom", "zoom"],
  ["pan-x", "x"],
  ["pan-y", "y"],
  ["photo-date", "date"],
])
  $(id).oninput = () => {
    if (!photos[selected]) return;
    if ($(id).value === "" || !$(id).checkValidity()) return;
    photos[selected][key] = key === "date" ? $(id).value : Number($(id).value);
    render();
  };
$("rotate").onclick = () => {
  const p = photos[selected];
  if (p) {
    p.rotation = (p.rotation + 90) % 360;
    render();
  }
};
$("reset").onclick = resetCrop;

const canvas = $("preview");
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function baseBoxes() {
  const { w, h } = dimensions();
  return cells(layout, w, h, +$("margin").value, +$("gap").value);
}
function frameBoxes() {
  const { w, h } = dimensions();
  return baseBoxes().map((b, i) => {
    const f = photos[i]?.frame || { dx: 0, dy: 0, sx: 1, sy: 1 };
    const width = clamp(b.w * f.sx, Math.min(6, b.w), w),
      height = clamp(b.h * f.sy, Math.min(6, b.h), h);
    return {
      x: clamp(b.x + b.w * f.dx, 0, w - width),
      y: clamp(b.y + b.h * f.dy, 0, h - height),
      w: width,
      h: height,
    };
  });
}
function saveFrame(i, r) {
  const b = baseBoxes()[i];
  photos[i].frame = {
    dx: (r.x - b.x) / b.w,
    dy: (r.y - b.y) / b.h,
    sx: r.w / b.w,
    sy: r.h / b.h,
  };
}
function drawSelection(ctx, boxes) {
  const r = boxes[selected];
  if (!r || !photos[selected]) return;
  const rect = canvas.getBoundingClientRect(),
    dim = dimensions(),
    unit = dim.w / (rect.width || 400);
  ctx.save();
  ctx.strokeStyle = "#305746";
  ctx.lineWidth = 1.5 * unit;
  ctx.setLineDash([]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
function point(event) {
  const r = canvas.getBoundingClientRect(),
    d = dimensions();
  return {
    x: ((event.clientX - r.left) * d.w) / r.width,
    y: ((event.clientY - r.top) * d.h) / r.height,
  };
}
function hit(pos) {
  const boxes = frameBoxes();
  for (let i = boxes.length - 1; i >= 0; i--) {
    const r = boxes[i];
    if (
      photos[i] &&
      pos.x >= r.x &&
      pos.x <= r.x + r.w &&
      pos.y >= r.y &&
      pos.y <= r.y + r.h
    )
      return i;
  }
  return -1;
}
function resetCrop() {
  const p = photos[selected];
  if (p) {
    Object.assign(p, { zoom: 1, x: 0, y: 0, rotation: 0 });
    syncEditor();
    render();
  }
}
canvas.addEventListener("click", (event) => {
  const index = hit(point(event));
  if (index < 0 || selected === index) return;
  selected = index;
  list();
  render();
});

// All image adjustments are explicit button or numeric-field actions.
for (const button of document.querySelectorAll("[data-adjust]")) {
  button.onclick = () => {
    const input = $(button.dataset.adjust);
    const value = Number(input.value) + Number(button.dataset.delta);
    input.value = clamp(
      Number(value.toFixed(4)),
      Number(input.min),
      Number(input.max),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
    syncEditor();
  };
}
for (const input of document.querySelectorAll(".stepper input"))
  input.addEventListener("change", syncEditor);
for (const button of document.querySelectorAll("[data-frame-move]")) {
  button.onclick = () => {
    if (!photos[selected] || !baseBoxes()[selected]) return;
    const r = frameBoxes()[selected],
      d = dimensions();
    const axis = button.dataset.frameMove;
    r[axis] = clamp(
      r[axis] + Number(button.dataset.delta),
      0,
      axis === "x" ? d.w - r.w : d.h - r.h,
    );
    saveFrame(selected, r);
    render();
    syncEditor();
  };
}
$("photo-date-mode").onchange = () => {
  if (!photos[selected]) return;
  photos[selected].dateMode = $("photo-date-mode").value;
  list();
  render();
};
for (const [id, key] of [
  ["frame-width", "sx"],
  ["frame-height", "sy"],
])
  $(id).oninput = () => {
    const p = photos[selected],
      b = baseBoxes()[selected];
    if (!p || !b || $(id).value === "" || !$(id).checkValidity()) return;
    const r = frameBoxes()[selected],
      d = dimensions();
    if (key === "sx")
      r.w = clamp(b.w * Number($(id).value), Math.min(6, b.w), d.w - r.x);
    else r.h = clamp(b.h * Number($(id).value), Math.min(6, b.h), d.h - r.y);
    saveFrame(selected, r);
    render();
  };
$("reset-frame").onclick = () => {
  if (photos[selected]) {
    delete photos[selected].frame;
    syncEditor();
    render();
  }
};
$("photo-date").oninput = () => {
  if (photos[selected]) {
    photos[selected].date = $("photo-date").value;
    render();
    list();
  }
};

$("export").onclick = async () => {
  if (!photos.length) {
    toast("请先添加至少一张照片");
    return;
  }
  const button = $("export");
  button.disabled = true;
  const output = document.createElement("canvas");
  try {
    const n = paint(output),
      unused = Math.max(0, photos.length - n);
    const blob = await new Promise((resolve) =>
      output.toBlob(resolve, "image/jpeg", 1),
    );
    if (!blob) throw Error("encoding");
    const jpg = new Blob(
      [
        jpegDensity(
          new Uint8Array(await blob.arrayBuffer()),
          Number($("dpi").value),
        ),
      ],
      { type: "image/jpeg" },
    );
    const url = URL.createObjectURL(jpg),
      a = document.createElement("a");
    a.href = url;
    a.download = `selphy-${$("paper").value}-${$("dpi").value}dpi.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(
      `高清 JPG 已导出 · ${output.width} × ${output.height} 像素` +
        (unused ? `；另有 ${unused} 张未放入当前页` : ""),
    );
  } catch {
    toast("导出失败，请尝试 300 DPI");
  } finally {
    button.disabled = false;
    output.width = output.height = 0;
  }
};
render();
