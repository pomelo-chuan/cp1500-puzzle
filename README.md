# 纸间 · SELPHY Studio

纯静态、无第三方依赖的 CP1500 拼图工作台。照片在本地浏览器处理，不上传服务器；刷新页面会清除编辑内容。

## 开发与验证

使用已有 checkout，无需额外 worktree。

```sh
npm test
python3 -m http.server 5173 --bind 0.0.0.0
```

支持单张、双联、四/六/九宫格与主图拼贴；裁切、旋转、顺序调整；白边、间距、拍立得底边、暖色和黑白；EXIF DateTimeOriginal / DateTime 日期或手动日期；300/600 DPI 像素尺寸 PNG/JPEG 导出。EXIF 日期解析仅针对 JPEG，其他格式可手填。每次导出当前页，未使用照片有数量提示。HEIC/RAW 请先转换，最多 50 张、单文件 40 MB。

## 打印尺寸

|介质|标称打印区域|说明|
|---|---|---|
|明信片|100 × 148 mm|常见 RP/KP 耗材|
|L|89 × 119 mm|地区供应有差异|
|卡片|54 × 86 mm|KC 耗材，PCC-CP400 纸匣|
|KC-18IS 方形贴纸|54 × 54 mm|贴纸区域，非整张卡片；须匹配佳能贴纸打印流程|

参考入口：https://www.canon-europe.com/printers/selphy-cp1500/specifications/ 。已于本次任务核对官网明信片、卡片、方形贴纸尺寸和 300 × 300 DPI 分辨率。欧洲规格未列 L 尺寸，因此 L 模板仅作地区待核实选项，使用前需核对本地区说明书与实际耗材。八枚小贴纸不提供定位模板。

导出像素 = mm × DPI / 25.4，未写入物理 DPI 元数据。打印时选择对应纸张；无边距可能裁切。3 mm 安全线仅预览，不导出。建议先少量试印。600 DPI 不会增加原片或打印机自身的分辨率。

## GitHub Pages

`.github/workflows/pages.yml` 在 main 推送时运行测试、上传纯静态文件并部署。首次需要仓库 Settings → Pages → Source 选择 **GitHub Actions**，并允许 Actions 执行。查看 Actions 中 Deploy GitHub Pages 的运行结果确认发布。预期地址：https://pomelo-chuan.github.io/cp1500-puzzle/ 。没有服务端或密钥需求。
