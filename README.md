# 纸间 · SELPHY Studio

基于 Fabric.js 7.4.0 的纯静态 CP1500 拼图工作台。照片在本地浏览器处理，不上传服务器；刷新页面会清除编辑内容。

## 开发与验证

使用已有 checkout，无需额外 worktree。

```sh
npm ci --omit=optional
npm test
npm run dev
```

支持单张、双联、四/六/九宫格与主图拼贴；裁切、旋转、顺序调整；白边、间距、拍立得底边、暖色和黑白；点击画布选中，右侧加减按钮与数值输入调整裁切、缩放和相框大小，方向按钮移动相框；画布不响应拖拽或滚轮缩放；EXIF DateTimeOriginal / DateTime 日期或手动日期，每张可独立显示或隐藏、默认橘色；300/600 DPI 像素尺寸 高清 JPG 一键导出（默认 600 DPI 像素尺寸，JPEG 最高质量）。EXIF 日期解析仅针对 JPEG，其他格式可手填。每次导出当前页，未使用照片有数量提示。HEIC/RAW 请先转换，最多 50 张、单文件 40 MB。

## 打印尺寸

|介质|标称打印区域|说明|
|---|---|---|
|明信片|100 × 148 mm|常见 RP/KP 耗材|
|L|89 × 119 mm|地区供应有差异|
|卡片|54 × 86 mm|KC 耗材，PCC-CP400 纸匣|
|KC-18IS 方形贴纸|54 × 54 mm|贴纸区域，非整张卡片；须匹配佳能贴纸打印流程|

参考入口：https://www.canon-europe.com/printers/selphy-cp1500/specifications/ 。已于本次任务核对官网明信片、卡片、方形贴纸尺寸和 300 × 300 DPI 分辨率。欧洲规格未列 L 尺寸，因此 L 模板仅作地区待核实选项，使用前需核对本地区说明书与实际耗材。八枚小贴纸不提供定位模板。

导出像素 = mm × DPI / 25.4，写入所选物理 DPI 元数据。打印时选择对应纸张；无边距可能裁切。3 mm 安全线仅预览，不导出。建议先少量试印。600 DPI 不会增加原片或打印机自身的分辨率。

## GitHub Pages

`.github/workflows/pages.yml` 在 main 推送时运行测试、上传纯静态文件并部署。首次需要仓库 Settings → Pages → Source 选择 **GitHub Actions**，并允许 Actions 执行。查看 Actions 中 Deploy GitHub Pages 的运行结果确认发布。预期地址：https://pomelo-chuan.github.io/cp1500-puzzle/ 。没有服务端或密钥需求。

## 浏览器交互回归

有 Playwright 和 Chromium 的环境中，可运行 `PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/browser.cjs`。先在另一终端启动本地开发服务。脚本验证点击调整、画布拖拽和滚轮不修改照片、独立日期、高清 JPG 下载及手机布局。

## Fabric 画布架构

`renderer.js` 使用 Fabric StaticCanvas、FabricImage、FabricText 和 Rect 管理图片、日期和相框。每张照片保留同一 Fabric 对象，按钮只更新属性；照片以原始像素坐标裁切，旋转后仍保持相框铺满。滤镜仅在切换效果时处理原图。画布不注册拖拽和滚轮交互。

`npm run build` 生成 `public/`，包含固定版本的 Fabric 浏览器模块与 MIT 许可证；运行时不请求 CDN。`vendor/` 由 npm 安装和开发命令生成，不提交生成文件。Pages 使用锁文件安装依赖、测试、构建后发布。

导出使用 Fabric 的倍率渲染和对象过滤，排除选中框、安全线及空位编号，保留原图精度；最后给最高质量 JPG 写入所选 DPI 元数据。浏览器回归还验证四个旋转方向的裁切颜色、对象复用、滤镜和预览辅助元素不会进入导出。
