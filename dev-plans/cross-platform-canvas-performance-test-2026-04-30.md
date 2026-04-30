# 跨平台 Canvas 性能测试指引

**日期**: 2026-04-30
**状态**: Pass with notes；Windows 遗留性能问题记录为 non-blocking follow-up
**范围**: Mac 作为服务端主机，Windows 11 / Windows 10 作为浏览器测试客户端

---

## 1. 测试目标

确认当前画布不只在开发用的 Mac 浏览器里顺滑，也能在 Windows 10 / Windows 11 的 Chrome 和 Edge 里保持可用。

重点测试：

- 25%-50% 画布缩放区间。
- 多张普通 canvas image。
- 多个 Image Node。
- Image Node -> Image Node 图片继承显示。
- 缩放、平移、拖动图片。
- runtime edge 连接和断开。
- Screenshot / Merge Capture / To Canvas。

这一步是进入 Slice E Real Asset Pipeline 之前的质量门。真实 AI 图片接入后，图片尺寸和密度都会更高，所以需要先确认不同系统和浏览器下的性能基线。

最终结论（2026-04-30）：

- Slice D 跨平台质量门按 `pass with notes` 通过。
- Windows 侧 50+ 图片/节点、50%-100% 缩放和 runtime edge 增长时仍可能轻微卡顿，但不再阻塞 Slice E。
- 不继续在 Cloudflare Tunnel + `next dev` 临时环境里追求完美。
- 下一步进入 Slice E Real Asset Pipeline，用真实多尺寸缩略图、对象存储和 Asset metadata 解决根本资产成本。

---

## 2. 设备分工

### Mac 开发机

在 Mac 上启动项目服务。

除非特别标注为 Windows 命令，下面的启动命令都在 Mac 终端里运行。

### Windows 11 电脑

作为第一台浏览器测试客户端。

测试：

- Chrome
- Edge
- 浏览器缩放 90%、100%、125%

### Windows 10 电脑

作为第二台浏览器测试客户端。

如果时间允许，测试同样的 Chrome / Edge / 浏览器缩放矩阵。

---

## 3. 网络要求

所有设备需要在同一个局域网里。

建议：

- Mac、Windows 11、Windows 10 连接同一个 Wi-Fi。
- 不要使用 guest Wi-Fi，很多 guest Wi-Fi 会禁止设备互相访问。
- 测试时先关闭 VPN，除非你就是要专门测试 VPN 场景。

如果当前网络是企业 / 公寓 / 共享 Wi-Fi，可能会开启 client isolation / AP isolation，导致 Windows 无法直接访问 Mac 的 `3000` 端口。此时可以使用第 7 节的 Cloudflare Tunnel 临时方案。

---

## 4. 在 Mac 上找到局域网 IP

在 Mac 终端运行：

```bash
ipconfig getifaddr en0
```

可能输出：

```text
192.168.1.23
```

这个 IP 就是 Windows 浏览器要访问的地址。比如：

```text
http://192.168.1.23:3000/spikes/canvas
```

如果 Mac 用的是有线网，或者上面的命令没有输出，可以试：

```bash
ifconfig | grep "inet "
```

找类似 `192.168.x.x` 或 `10.0.x.x` 的局域网地址。

---

## 5. 在 Mac 上启动项目

### 方案 A - 开发模式

适合快速测试和边改边看：

```bash
npm -C apps/web run dev -- --hostname 0.0.0.0 --port 3000
```

Mac 自己打开：

```text
http://127.0.0.1:3000/spikes/canvas
```

Windows 打开：

```text
http://<MAC_LOCAL_IP>:3000/spikes/canvas
```

比如：

```text
http://192.168.1.23:3000/spikes/canvas
```

### 方案 B - 生产模式

更适合最终性能判断，因为它比 `next dev` 更接近真实上线环境：

```bash
npm -C apps/web run build
cd apps/web
npx next start -H 0.0.0.0 -p 3000
```

Windows 打开：

```text
http://<MAC_LOCAL_IP>:3000/spikes/canvas
```

建议最终结论以方案 B 为准。

当前 tldraw SDK 在 production deployment 下会检查 license key。若未配置 tldraw production license，`next start` 可能出现 `No tldraw license key provided`，导致 editor 无法初始化。这是本地 spike 的生产模式限制，不代表 Windows 性能问题。正式上线前需要补齐 tldraw license / 商业授权路径。

---

## 6. 临时 Tunnel 测试方案

当局域网设备互访被企业 Wi-Fi / 共享 Wi-Fi 禁止时，使用 Cloudflare Tunnel 暂时暴露 Mac 本地 3000：

```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel --url http://localhost:3000
```

Cloudflare 会输出一个临时地址，例如：

```text
https://xxxx.trycloudflare.com
```

Windows 打开：

```text
https://xxxx.trycloudflare.com/spikes/canvas
```

如果使用 `next dev` + Cloudflare Tunnel，需要把 tunnel 域名放进 Next dev allowed origins，否则 Next 会拦截 `/_next/webpack-hmr`：

```bash
NEXT_ALLOWED_DEV_ORIGINS=xxxx.trycloudflare.com npm -C apps/web run dev -- --hostname 0.0.0.0 --port 3000
```

当前 repo 里的 `apps/web/next.config.mjs` 支持通过 `NEXT_ALLOWED_DEV_ORIGINS` 读取这个临时域名。

重要：

- Tunnel 地址是临时的，终端里的 `cloudflared` 一关就失效。
- `NEXT_ALLOWED_DEV_ORIGINS` 只是测试支架，不是正式部署方案。
- 当前加入的 `CanvasRuntimeDiagnostics` 红色诊断面板也是测试支架，用来抓 Windows / tunnel 下的初始化错误；默认关闭，仅 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 时启用。
- 跨平台测试结束后，应该删除或继续保持这些临时支架默认关闭。
- 正式上线应使用真实部署域名、正常 HTTPS、后端服务和 tldraw production license，不使用 quick tunnel。

---

## 7. Windows 打不开页面时怎么排查

### 在 Windows 上检查能不能连到 Mac

打开 Command Prompt 或 PowerShell：

```powershell
ping <MAC_LOCAL_IP>
```

比如：

```powershell
ping 192.168.1.23
```

如果 ping 不通：

- 确认 Windows 和 Mac 在同一个 Wi-Fi。
- 关闭 VPN。
- 检查是不是连到了 guest Wi-Fi。
- 检查路由器是否开启了 client isolation / AP isolation。

如果 ping 通了，但浏览器打不开页面：

- 确认 Mac 上的服务是用 `--hostname 0.0.0.0` 启动的。
- 确认浏览器地址里有 `:3000`。
- 检查 macOS Firewall，允许 Node / Next.js 接收入站连接。
- 确认 Mac 终端里的服务没有退出。

### 在 Mac 上确认服务正常

运行：

```bash
curl -I http://127.0.0.1:3000/spikes/canvas
```

预期看到：

```text
HTTP/1.1 200 OK
```

---

## 8. 浏览器测试矩阵

最低测试：

| 设备 | 浏览器 | 浏览器缩放 |
| --- | --- | --- |
| Windows 11 | Chrome | 100% |
| Windows 11 | Edge | 100% |
| Windows 10 | Chrome | 100% |
| Windows 10 | Edge | 100% |

推荐测试：

| 设备 | 浏览器 | 浏览器缩放 |
| --- | --- | --- |
| Windows 11 | Chrome | 90%、100%、125% |
| Windows 11 | Edge | 90%、100%、125% |
| Windows 10 | Chrome | 90%、100%、125% |
| Windows 10 | Edge | 90%、100%、125% |

可选 Mac 对照测试：

| 设备 | 浏览器 | 浏览器缩放 |
| --- | --- | --- |
| Mac | Chrome | 100% |
| Mac | Safari | 100% |

---

## 9. 测试画布规模

### 小画布

创建：

- 5 张普通 canvas image。
- 5 个 Image Node。
- 3-5 条 runtime edge。

预期：

- 没有明显视觉回归。
- Image Node -> Image Node 能显示继承图片。
- 自带图片的 Image Node 和继承图片的 Image Node 都能 To Canvas。
- Screenshot / Merge Capture 能生成可见的 Image Node。

### 中等画布

创建：

- 30 个混合图片对象，包括普通 canvas image 和 Image Node。
- 如果方便，再加 30 个 AI 节点。
- 几条 runtime edge。

测试：

- 缩放到 25%、35%、50%、100%。
- 快速 pan 画布。
- 拖动多张图片。
- 连接和断开 runtime edge。
- canvas image -> Image Node。
- Image Node -> To Canvas。

预期：

- 25%-50% 缩放区间仍然可控。
- 不出现长时间浏览器冻结。
- 图片不会永久消失。
- 缩略图和高清预览恢复的感觉可以接受。

### 密集画布

创建：

- 100 个混合图片对象，包括普通 canvas image 和 Image Node。
- 如果方便，再加 50 个 AI 节点。

测试：

- 低缩放下看整个 board。
- 25%-50% 缩放区间。
- 100% 缩放下拖动图片和连线。
- 对一个小选区做 Merge Capture。

预期：

- 有一点渲染成本可以接受。
- 浏览器不应该锁死。
- 拖动和缩放仍然能控制。
- 节点端口和 runtime edge 仍然基本可点击。

---

## 10. 问题记录格式

每个问题按这个格式记：

```text
设备:
浏览器:
浏览器缩放:
屏幕分辨率:
画布规模:
画布缩放:
操作:
实际发生:
预期应该:
截图 / 录屏:
```

示例：

```text
设备: Windows 11 laptop
浏览器: Edge
浏览器缩放: 125%
屏幕分辨率: 1920x1080
画布规模: 30 images / 30 nodes
画布缩放: 35%
操作: 选中两个 Image Node 后快速 pan
实际发生: 卡住约 1 秒，然后恢复
预期应该: 轻微顿挫可以接受，但不应该整秒冻结
```

---

## 11. 通过标准

Slice D 跨平台质量门通过的标准：

- Windows 11 Chrome 和 Edge 在 100% 浏览器缩放下可用。
- Windows 10 Chrome 和 Edge 在 100% 浏览器缩放下可用。
- 中等画布在 25%-50% 画布缩放下仍然可控。
- 图片不会永久消失。
- 浏览器标签页不会反复崩溃。
- Image Node -> Image Node 图片继承正常。
- To Canvas、Convert to Image Node、Screenshot、Merge Capture 仍然可用。

如果 90% 或 125% 浏览器缩放比 100% 明显差，但 100% 通过，可以先记录为后续阈值调优问题，不阻塞 Slice E。只有严重卡死、崩溃、图片丢失才算阻塞。

---

## 12. 测试后清理项

跨平台测试已完成；正式提交前清理：

- 停掉 `cloudflared tunnel`。
- 停掉临时 `next dev`。
- 确认 `CanvasRuntimeDiagnostics` 默认关闭，仅 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 时启用；后续也可直接删除。
- 如果删除 diagnostics，同步移除 `canvas-runtime-diagnostics` 样式。
- 如果删除 diagnostics，同步移除 `CanvasSpike` 对诊断组件的引用。
- 移除或保留为空的 `NEXT_ALLOWED_DEV_ORIGINS` 测试配置；正式部署不要依赖 quick tunnel。
- 如果需要用 production server 做正式验收，先配置 tldraw production license。
- 检查 `apps/web/next-env.d.ts` 是否被 `next dev` 自动改成 `.next/dev/types/routes.d.ts`；提交前应恢复为项目基线，不把这个生成态差异当成功能变更。
- 当前记录到的临时进程：`node` 监听 `*:3000`（PID 4827），`cloudflared tunnel --url http://localhost:3000`（PID 1145）。

---

## 13. 当前 Windows 发现与补丁记录

### 2026-04-30 Windows 11 / tunnel 手测

现象：

- 局域网直连失败来自企业 / 共享 Wi-Fi 的设备隔离，改用 Cloudflare Tunnel 后 Windows 可以打开页面。
- tunnel 不是正式部署形态；正式上线、多用户协作和真实域名部署不应依赖 quick tunnel。
- Windows 画布缩放低于 50% 时相对顺滑。
- 约 50%-100% 画布缩放时，随着 Image Node、Image Gen 输出图、runtime edge 数量增加，开始明显卡顿。
- 典型卡顿操作：连接 runtime edge、复制图片、拖动图片、缩放图片节点 / AI 节点。

判断：

- 这不是 tunnel 本身必须存在的线上问题，但 tunnel 会增加本轮测试的不确定性。
- 更核心的瓶颈是 Windows Chrome / Edge 在密集图片 + 节点 + 连线变化时，对高清图片渲染和 React 节点重算更敏感。
- 因此本轮补丁只作为跨平台阈值调优，不把 tunnel 当作生产方案。

已加补丁：

- 端口连线期间也进入 canvas interaction LOD。
- 50+ image-like 对象时，交互中的 50%-100% 缩放优先显示 thumbnail，而不是 full 原图。
- 48+ image-like 对象时，空闲态 110% 以下也保持 thumbnail；80+ 时延长到 120% 以下，避免 100% 附近出现明显 full 原图切换卡顿。
- 高密度节点在交互中更早进入 shell，保留标题和端口，减少完整表单 / preview 重算。
- NodeCard / Inspector 对 runtime edge store 的订阅从全量 edges 缩小到当前节点相关 edges。
- 连接 / 断开 runtime edge 后，只同步受影响目标节点的动态 image input 端口数量，不再扫描并更新所有节点。
- 画布最大缩放从 tldraw 默认 800% 限制到 500%，避免进入对当前产品没有意义且明显更重的超高倍缩放区间。

后续观察：

- 如果 50%-100% 仍明显卡顿，下一步应优先做 viewport-aware 节点/图片挂载或更细的 selected / visible edge 订阅，而不是继续依赖 tunnel 支架。
