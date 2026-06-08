# Pix Avatar Trait Studio 操作手册

这份手册面向 `Pix Avatar Trait Studio`，也就是本 repo 本地启动后打开的 32x32 手工 trait 素材编辑平台。它的目标不是直接调随机参数，而是把参考测试集里的脸型、发型、五官、配饰、衣服等稳定拆成可复用素材，再通过组合预览和 CLI 渲染验证这些素材能否逼近参考集风格。

## 1. 启动

在 repo 根目录执行：

```bash
npm install
npm run dev
```

Vite 会打印一个本地地址，通常是：

```text
http://127.0.0.1:5173/
```

浏览器打开后，页面标题是 `Pix Avatar Trait Studio`。

## 2. 界面区域

- 顶部工具栏：选择内置参考图、上传自定义参考图、调参考图透明度、切换参考图显示、导入模板、导出模板、导出 Avatar Spec。
- 左侧图层栏：选择当前编辑的 trait slot，例如 `face.shape`、`hair.style`、`eyes.shape`、`glasses.shape`。
- 中间画布：32x32 像素编辑区。参考图会作为 underlay 显示，手动画出来的 trait 像素会叠在上面。
- 右侧工具栏：画笔、橡皮、吸管、颜色、笔刷大小、缩放、网格、撤销、重做、保存当前图层为素材。
- 右侧 Preview：把已经保存的素材按 slot 组合起来，检查跨素材组合后的头像是否正常。

## 3. 推荐工作流

按下面流程处理每一个参考头像：

1. 在顶部 `Reference` 选择一个内置头像，例如 `avatar-01`。
2. 打开参考图显示，把 `Opacity` 调到 45%-70%。如果看不清边界，临时提高透明度；如果看不清自己画的素材，降低透明度。
3. 先画大结构，再画小细节。推荐顺序是 `background.style` -> `clothing.top` -> `ears.shape` -> `face.shape` -> `hair.style` -> `headwear.type` -> `eyes.shape` -> `eyebrows.shape` -> `nose.shape` -> `mouth.shape` -> `facial_hair.style` -> `glasses.shape`。
4. 对每个 slot，用吸管从参考图取色，然后用画笔描出该部位的像素块。画错时用橡皮擦掉。
5. 一个 slot 只放一个语义部位。例如头发不要混入脸、眼镜不要混入眼睛、衣服不要混入背景。
6. 当前图层完成后，点击 `Save`，命名为容易追踪的素材名，例如 `avatar-01-right-face`、`avatar-01-bob-hair`。
7. 在 Preview 里选择刚保存的素材，和其他 slot 的素材交叉组合，确认没有明显穿帮、遮挡、错层、孤立噪点。
8. 完成一组素材后，点击 `Template` 导出 `.manual-traits.json`。这是后续继续编辑和复现素材库的主文件。
9. 如果需要直接喂给渲染器或 SDK，点击 `Spec` 导出 `.avatar-spec.json`。

## 4. 图层和叠放规则

平台使用固定的图层顺序，后面的图层会盖住前面的图层：

| 编辑 slot | 用途 | 注意点 |
| --- | --- | --- |
| `background.style` | 背景底色或背景块 | 只放背景，不要放人物轮廓 |
| `clothing.top` | 衣服、领口、肩部 | 不要覆盖脸和头发 |
| `ears.shape` | 耳朵 | 耳朵通常在脸后、头发前，需要避免和发型重复 |
| `face.shape` | 脸型、脖子、皮肤主体 | 这是最重要的结构层，优先拟合轮廓 |
| `hair.style` | 头发主体 | 发际线、刘海、侧边轮廓要干净 |
| `headwear.type` | 帽子、发带等头部配饰 | 只放配饰，不要把头发合进去 |
| `eyes.shape` | 眼睛 | 适合保持简洁，不要把眼镜框画进来 |
| `eyebrows.shape` | 眉毛 | 如果参考图没有明显眉毛，可以留空 |
| `nose.shape` | 鼻子 | 用少量深色或阴影像素表达即可 |
| `mouth.shape` | 嘴巴 | 尽量保持卡通化、小而清晰 |
| `facial_hair.style` | 胡子等面部毛发 | 和嘴巴分开，避免混进皮肤层 |
| `glasses.shape` | 眼镜 | 眼镜在眼睛上方，框和镜片都放这里 |

## 5. 把参考色块转成 trait 的验收标准

每个 segment 或手工色块保存为素材前，建议按这组标准检查：

- 语义单一：这个图层只表达一个部位，不把多个部位合并到同一个素材里。
- 边界完整：脸型、头发、衣服等大结构的轮廓连续，没有明显缺口。
- 噪点清理：去掉孤立 1px 噪点、JPEG 水印残留、参考图编号残留。
- 层级正确：眼镜盖在眼睛上，头发盖在脸上，衣服不会盖住下巴。
- 泛化可用：换一张脸或换一个发型预览后，素材仍然大体合理。
- 风格一致：优先拟合朝右脸型、简单五官、卡通轮廓、丰富但干净的发型和配饰；颜色可以后续再调，不要为了颜色牺牲结构。

如果一个自动 segment 不满足这些标准，不要直接纳入素材库。先在画布里手工擦掉噪点、拆分混合部位，或者重新按 slot 描一版。

## 6. 导入、导出和复现

### Template

`Template` 会导出 `.manual-traits.json`。它包含所有手工图层像素，适合继续编辑、版本管理、复现和人工 review。建议把它当作手工素材工作的主交付物。

重新打开页面后，可以用 `Import` 载入之前导出的 template。

### Avatar Spec

`Spec` 会导出 `.avatar-spec.json`。它是渲染器可直接使用的 Avatar Spec，适合进入 CLI、SDK 或 HTTP API 流程。

### CLI 渲染 template

如果手上有 `.manual-traits.json`，可以直接渲染 PNG，并可同时导出 spec：

```bash
npm run render:manual-template -- --input ./my-traits.manual-traits.json --out ./avatar.png --specOut ./avatar-spec.json
```

输出 PNG 默认是 32x32 逻辑画布按 scale 放大后的结果。

## 7. 本地保存机制

点击 `Save` 保存的素材会存到浏览器 `localStorage`，用于当前浏览器里的快速预览和组合。它不是长期可靠的数据源，清浏览器数据或换浏览器后可能丢失。

长期保存请使用 `Template` 导出的 `.manual-traits.json`。

## 8. QA 检查清单

完成一批素材后，至少做这几项检查：

- 单参考复现：同一张参考图拆出来的 face、hair、eyes、mouth、clothing 能组合成接近原图的头像。
- 跨参考组合：拿 `avatar-01` 的脸配 `avatar-02` 的头发，再换一组眼镜和衣服，观察是否严重错位。
- 小图可读性：把画布缩到真实 32x32 或低倍数，确认脸型、眼睛、嘴巴仍然可读。
- 叠层检查：打开和关闭单个 layer，确认每个 slot 都只负责自己的部位。
- 导出复现：导出 template 后重新 import，画布应能恢复；用 CLI 渲染后 PNG 应与页面 preview 结构一致。

## 9. 常见问题

### 看不到参考图

确认顶部参考图开关是显示状态，并提高 `Opacity`。如果使用自定义图片，建议上传正方形或接近正方形的头像参考图；平台会按 32x32 画布进行采样显示。

### 保存按钮不可用

当前图层没有像素时不能保存。先选择一个 slot，在画布上画出至少一个像素。

### 导出的 spec 和页面看起来不完全一样

优先确认导出的是 `Spec` 还是 `Template`。`Template` 是编辑源文件，`Spec` 是渲染器输入。若要从 template 复现 PNG，使用 `npm run render:manual-template`。

### 组合后五官错位

这通常说明五官素材仍是绝对位置素材，和某些脸型不兼容。先把同一参考图的脸和五官作为 face-kit 一起验证；如果要泛化，需要为五官增加不同位置版本，或者把五官相对脸型的锚点规则做进生成器。

### 自动 segment 结果看起来很准，但组合后很怪

自动 segment 可能把颜色相近但语义不同的部位合并，例如头发和眼镜、脸和耳朵、衣服和背景。纳入素材库前必须按第 5 节的验收标准人工 review。

