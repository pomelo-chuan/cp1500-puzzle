import {
  StaticCanvas,
  FabricImage,
  FabricText,
  Rect,
  Point,
  Shadow,
  filters,
  Canvas2dFilterBackend,
  setFilterBackend,
} from "./vendor/fabric.mjs";

// CPU filtering avoids WebGL texture-size limits on large original photos.
setFilterBackend(new Canvas2dFilterBackend());
const base = {
  originX: "left",
  originY: "top",
  strokeWidth: 0,
  objectCaching: false,
  selectable: false,
  evented: false,
};
const rectangle = (options) => new Rect({ ...base, ...options });

export class PhotoRenderer {
  constructor(element) {
    this.canvas = new StaticCanvas(element, {
      enableRetinaScaling: false,
      renderOnAddRemove: false,
    });
    this.nodes = new Map();
    this.placeholders = new Map();
    this.selection = rectangle({
      fill: "transparent",
      stroke: "#305746",
      excludeFromExport: true,
    });
    this.safe = rectangle({
      fill: "transparent",
      stroke: "#889c7c99",
      strokeWidth: 0.15,
      strokeDashArray: [1, 1],
      excludeFromExport: true,
    });
  }
  photoNode(photo) {
    if (!this.nodes.has(photo)) {
      this.nodes.set(photo, {
        frame: rectangle({}),
        image: new FabricImage(photo.img, {
          ...base,
          originX: "center",
          originY: "center",
        }),
        date: new FabricText("", {
          ...base,
          fontFamily: "monospace",
          originX: "right",
          originY: "center",
          clipPath: rectangle({ absolutePositioned: true }),
        }),
        effect: null,
      });
    }
    return this.nodes.get(photo);
  }
  update({
    dim,
    boxes,
    photos,
    selected,
    background,
    polaroid,
    effect,
    dates,
    dateColor,
    safe,
  }) {
    this.dim = dim;
    // The preview's logical units are millimetres. Its raster size is independent of export DPI.
    const width = dim.w * 10,
      height = dim.h * 10;
    if (this.canvas.width !== width || this.canvas.height !== height)
      this.canvas.setDimensions({ width, height });
    this.canvas.setViewportTransform([10, 0, 0, 10, 0, 0]);
    this.canvas.backgroundColor = background;
    this.canvas.lowerCanvasEl.style.width = `min(100%, ${((window.innerWidth <= 650 ? 480 : 600) * dim.w) / dim.h}px)`;
    this.canvas.lowerCanvasEl.style.height = "auto";
    const objects = [];
    this.targets = [];
    for (const [i, r] of boxes.entries()) {
      const photo = photos[i];
      if (!photo) {
        if (!this.placeholders.has(i))
          this.placeholders.set(i, {
            frame: rectangle({ fill: "#f0f1ea", excludeFromExport: true }),
            label: new FabricText(String(i + 1), {
              ...base,
              originX: "center",
              originY: "center",
              fontFamily: "sans-serif",
              fill: "#bac2b0",
              excludeFromExport: true,
            }),
          });
        const node = this.placeholders.get(i);
        node.frame.set({ left: r.x, top: r.y, width: r.w, height: r.h });
        node.label.set({
          left: r.x + r.w / 2,
          top: r.y + r.h / 2,
          fontSize: Math.min(r.w, r.h) * 0.17,
        });
        objects.push(node.frame, node.label);
        continue;
      }
      const node = this.photoNode(photo);
      node.frame.set({
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        fill: background,
      });
      node.frame.setCoords();
      this.targets.push({ index: i, frame: node.frame });
      const bottom = polaroid ? Math.min(9, r.h * 0.22) : 0,
        ih = r.h - bottom;
      const rotated = photo.rotation % 180 !== 0,
        iw = rotated ? photo.img.naturalHeight : photo.img.naturalWidth,
        hh = rotated ? photo.img.naturalWidth : photo.img.naturalHeight;
      const factor = Math.max(r.w / iw, ih / hh) * photo.zoom;
      // Crop in source-image coordinates: no oversized clip caches, even for 600 DPI export.
      const cw = (rotated ? ih : r.w) / factor,
        ch = (rotated ? r.w : ih) / factor;
      const ox = (photo.x * (iw * factor - r.w)) / 2,
        oy = (photo.y * (hh * factor - ih)) / 2;
      const angle = (photo.rotation * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      node.image.set({
        left: r.x + r.w / 2,
        top: r.y + ih / 2,
        angle: photo.rotation,
        scaleX: factor,
        scaleY: factor,
        width: cw,
        height: ch,
        cropX: Math.max(
          0,
          (photo.img.naturalWidth - cw) / 2 + (cos * ox + sin * oy) / factor,
        ),
        cropY: Math.max(
          0,
          (photo.img.naturalHeight - ch) / 2 + (-sin * ox + cos * oy) / factor,
        ),
      });
      if (node.effect !== effect) {
        node.image.filters =
          effect === "mono"
            ? [new filters.Grayscale()]
            : effect === "warm"
              ? [
                  new filters.Sepia(),
                  new filters.Saturation({ saturation: -0.15 }),
                  new filters.Contrast({ contrast: 0.04 }),
                ]
              : [];
        node.image.applyFilters();
        node.effect = effect;
      }
      node.date.set({
        text: dates[i],
        visible: !!dates[i],
        left: r.x + r.w - 2,
        top: r.y + (bottom ? ih + bottom / 2 : ih - 3),
        fontSize: Math.max(1.4, Math.min(2.5, r.w / 14)),
        fill: bottom && dateColor === "#ffffff" ? "#3e463b" : dateColor,
        scaleX: 1,
        shadow: bottom
          ? null
          : new Shadow({ color: "#000b", blur: 2, offsetX: 0, offsetY: 0 }),
      });
      node.date.set({
        scaleX: Math.min(
          1,
          Math.max(0.5, r.w - 4) / Math.max(0.01, node.date.width),
        ),
      });
      node.date.clipPath.set({ left: r.x, top: r.y, width: r.w, height: r.h });
      objects.push(node.frame, node.image, node.date);
    }
    this.safe.set({
      left: 3,
      top: 3,
      width: dim.w - 6,
      height: dim.h - 6,
      visible: safe,
    });
    const selectedBox = boxes[selected];
    this.selection.set({
      visible: !!selectedBox && !!photos[selected],
      strokeWidth:
        (1.5 * dim.w) /
        (this.canvas.lowerCanvasEl.getBoundingClientRect().width || 400),
      ...(selectedBox
        ? {
            left: selectedBox.x,
            top: selectedBox.y,
            width: selectedBox.w,
            height: selectedBox.h,
          }
        : {}),
    });
    objects.push(this.safe, this.selection);
    // Retain Fabric image/filter objects between edits; only reconcile membership and stacking.
    const wanted = new Set(objects);
    for (const object of this.canvas.getObjects())
      if (!wanted.has(object)) this.canvas.remove(object);
    const existing = new Set(this.canvas.getObjects());
    objects.forEach((object, index) => {
      if (!existing.has(object)) this.canvas.add(object);
      this.canvas.moveObjectTo(object, index);
    });
    const retained = new Set(photos);
    for (const [photo, node] of this.nodes)
      if (!retained.has(photo)) {
        node.image.dispose();
        node.date.dispose();
        node.frame.dispose();
        this.nodes.delete(photo);
      }
    this.canvas.renderAll();
  }
  hit(clientX, clientY) {
    const bounds = this.canvas.lowerCanvasEl.getBoundingClientRect();
    const point = new Point(
      ((clientX - bounds.left) * this.dim.w) / bounds.width,
      ((clientY - bounds.top) * this.dim.h) / bounds.height,
    );
    return (
      this.targets.findLast((target) => target.frame.containsPoint(point))
        ?.index ?? -1
    );
  }
  exportCanvas() {
    const multiplier = this.dim.pxW / this.canvas.width;
    return this.canvas.toCanvasElement(multiplier, {
      // Avoid subpixel floating-point truncation when the DOM canvas rounds its dimensions.
      width: (this.dim.pxW + 0.001) / multiplier,
      height: (this.dim.pxH + 0.001) / multiplier,
      filter: (object) => !object.excludeFromExport,
    });
  }
}
