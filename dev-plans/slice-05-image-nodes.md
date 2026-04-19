# Slice 5: Image Generation Nodes + Storage

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 4 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现图像生成节点（Midjourney V7、Imagen 3）和图片上传节点，集成 MinIO 存储服务，支持图片预览放大和下载。

---

## 后端步骤

### Step 1: 数据库模型 — Asset

**文件**: `backend/app/models/asset.py`

```
assets 表:
  id                UUID PK
  user_id           UUID FK → users.id, NOT NULL
  workflow_id       UUID FK → workflows.id, NULLABLE
  node_id           VARCHAR(50) NOT NULL
  type              ENUM('image', 'video', 'audio', 'html') NOT NULL
  storage_path      VARCHAR(500) NOT NULL
  original_filename VARCHAR(255) NULLABLE
  size_bytes        BIGINT NOT NULL
  mime_type         VARCHAR(100) NOT NULL
  is_public         BOOLEAN DEFAULT false
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()

索引:
  idx_assets_user ON assets(user_id)
  idx_assets_workflow ON assets(workflow_id)

约束:
  storage_path UNIQUE
```

**文件**: `backend/app/models/__init__.py` — 添加 `from .asset import Asset`

### Step 2: Alembic 迁移

```bash
cd backend && alembic revision --autogenerate -m "add assets table"
alembic upgrade head
```

### Step 3: MinIO 存储服务

**文件**: `backend/app/services/storage_service.py`

```
class StorageService:

  __init__():
    - 从 config 读取 MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
    - 初始化 MinIO client (minio.Minio)
    - 确保 "tanvas" bucket 存在，不存在则创建

  async upload_file(
    file: UploadFile | bytes,
    user_id: str,
    content_type: str,
    file_extension: str,
    workflow_id: str | None = None,
  ) -> str:
    """
    上传文件到 MinIO。
    - 存储路径: users/{user_id}/{year}/{month}/{uuid}.{ext}
    - 返回 storage_path (不含 bucket 名)
    - 使用 put_object，part_size=10MB
    """

  async get_signed_url(storage_path: str, expires: timedelta = timedelta(hours=1)) -> str:
    """
    生成预签名 URL。
    - 用于图片预览和下载
    - 默认有效期 1 小时
    """

  async get_permanent_url(storage_path: str) -> str:
    """
    生成永久访问 URL。
    - 如果 bucket 设置了公开读策略: 直接拼接 URL
    - 否则: 使用较长过期时间的签名 URL (7 天)
    - 注意: PRD 要求图片下载链接有效期不限
    - 实现方式: 使用较长的签名有效期 + 前端缓存
    """

  async delete_file(storage_path: str) -> None:
    """删除 MinIO 中的文件"""

  validate_image_file(filename: str, content_type: str, size_bytes: int) -> None:
    """
    校验图片文件:
    - 格式: JPG/PNG/WebP (检查 MIME type)
    - 大小: ≤ 20MB
    - 不合法 → raise ValueError
    """
```

### Step 4: Asset API 路由

**文件**: `backend/app/api/v1/assets.py`

```
POST /api/v1/assets/upload
  - 依赖 get_current_user
  - Content-Type: multipart/form-data
  - 字段: file (UploadFile), workflow_id (可选), node_id
  - 校验: validate_image_file()
  - storage_service.upload_file()
  - 写入 assets 表
  - 返回 201 { id, storage_path, url }

GET /api/v1/assets/:id/download
  - 依赖 get_current_user
  - 查询 assets WHERE id = asset_id AND user_id = current_user.id
  - 不存在 → 404
  - 权限校验: 只能下载自己的资产（除非 is_public=true）
  - 返回 redirect 到 signed URL

GET /api/v1/assets?workflow_id=xx
  - 依赖 get_current_user
  - 查询 assets WHERE user_id = current_user.id AND workflow_id = workflow_id
  - 返回资产列表

DELETE /api/v1/assets/:id
  - 依赖 get_current_user
  - 校验 user_id
  - 删除 MinIO 文件 + 数据库记录
  - 返回 200
```

**文件**: `backend/app/main.py` — 添加 assets router

### Step 5: Image Upload 节点执行器

**文件**: `backend/app/nodes/upload.py`

```
@register_node("image_upload")
class ImageUploadNodeExecutor(NodeExecutor):

  inputs: []  (无，图片通过前端上传到 MinIO)
  outputs:
    image: str (MinIO URL)

  execute():
    1. 从 config 获取 storage_path (前端上传后传入)
    2. 生成 signed URL
    3. 返回 NodeResult(outputs={"image": signed_url})

  注意: 上传节点实际上传在前端完成 (POST /assets/upload)，
  后端执行器仅返回已有 URL
```

### Step 6: Midjourney V7 节点执行器

**文件**: `backend/app/nodes/image_mj.py`

```
@register_node("image_mj")
class MidjourneyNodeExecutor(NodeExecutor):

  config 字段:
    aspect_ratio: str (默认 "1:1")
      可选: "1:1" | "16:9" | "9:16"
    speed_mode: str (默认 "fast")
      可选: "fast" | "standard"
    negative_prompt: str (默认 "")
    seed: int | None

  inputs:
    prompt: str (必填，提示词)
    image: str (可选，参考图片 URL)

  outputs:
    image: list[str] (4 张图片 URL)

  execute():
    1. validate_inputs(["prompt"])
    2. 构造 MJ API 请求:
       - 使用 useapi.net 代理或官方 MJ API
       - prompt = inputs["prompt"]
       - 如果有参考图片 → 添加 --sref 或 --cref 参数
       - ar = config["aspect_ratio"] 转换为 MJ 格式
       - speed: fast → --fast
    3. 提交任务，获取 task_id
    4. 轮询任务状态 (间隔 5 秒，最长等待 300 秒):
       - 调用 context.report_progress() 报告进度
       - 状态 "completed" → 获取图片 URLs
       - 状态 "failed" → raise 错误
       - 超时 → raise TimeoutError
    5. 下载 4 张图片到 MinIO:
       - 每张图片: fetch → upload_file() → 记录 Asset
       - storage_path 列表
    6. 生成签名 URLs
    7. 返回 NodeResult(
         outputs={"image": [url1, url2, url3, url4]},
         assets=[{...} × 4]
       )

  错误处理:
    - MJ 队列满 → 友好提示 "MJ 队列繁忙，预计等待 N 分钟"
    - 内容违规 → "该内容不符合内容政策，请修改提示词后重试"
    - API Key 无效 → "图像生成服务暂时不可用"
```

### Step 7: Imagen 3 节点执行器

**文件**: `backend/app/nodes/image_imagen.py`

```
@register_node("image_imagen")
class ImagenNodeExecutor(NodeExecutor):

  config 字段:
    aspect_ratio: str (默认 "1:1")
    number_of_images: int (默认 1, 范围 1-4)
    negative_prompt: str (默认 "")
    seed: int | None

  inputs:
    prompt: str (必填)

  outputs:
    image: str | list[str] (1-4 张图片 URL)

  execute():
    1. validate_inputs(["prompt"])
    2. 调用 Google Vertex AI Imagen 3 API:
       - 使用 google-cloud-aiplatform SDK
       - project = GCP_PROJECT_ID
       - model = "imagen-3.0-generate-002"
       - prompt = inputs["prompt"]
       - aspect_ratio = config["aspect_ratio"]
       - number_of_images = config["number_of_images"]
       - negative_prompt = config["negative_prompt"]
    3. 获取生成图片 (base64)
    4. 保存到 MinIO:
       - 每个 base64 解码 → bytes → upload_file()
       - 记录 Asset
    5. 生成签名 URLs
    6. 返回 NodeResult(
         outputs={"image": urls},
         assets=[{...}]
       )

  错误处理:
    - 同 image_mj 错误处理策略
    - GCP 认证失败 → 友好提示
```

### Step 8: Asset Schema

**文件**: `backend/app/schemas/asset.py`

```
AssetUploadResponse:
  id: str
  storage_path: str
  url: str
  type: str

AssetOut:
  id: str
  type: str
  storage_path: str
  url: str
  size_bytes: int
  mime_type: str
  created_at: datetime
```

---

## 前端步骤

### Step 9: ImageUploadNode 组件

**文件**: `frontend/src/nodes/upload/ImageUploadNode.tsx`

```
使用 NodeBase 包裹

inputs: []
outputs: [{ id: "image", type: "image", label: "图片" }]

内容区:
  - 拖拽上传区域:
    ┌─────────────────────────┐
    │                         │
    │   拖拽图片到此处        │  ← 虚线边框, #f5f5f5 背景
    │   或点击选择文件        │
    │   支持 JPG/PNG/WebP    │  ← 12px #898989
    │   最大 20MB             │
    └─────────────────────────┘

  - 上传后显示:
    ┌─────────────────────────┐
    │ [缩略图]  filename.jpg  │
    │           1.2 MB  [×]   │  ← [×] 删除按钮
    └─────────────────────────┘

交互:
  - 拖拽: onDragOver 高亮边框
  - 粘贴: 支持 Ctrl+V 粘贴图片
  - 文件校验 (前端预检):
    - 格式: JPG/PNG/WebP
    - 大小: ≤ 20MB
    - 不合法: 红色提示 "文件不能超过 20MB" / "仅支持 JPG、PNG、WebP 格式"
  - 上传: POST /api/v1/assets/upload (multipart/form-data)
  - 上传中: 进度条
  - 上传失败: "上传失败，请重试" + 重试按钮

节点数据:
  {
    storagePath: string | null
    fileName: string | null
    fileSize: number | null
    previewUrl: string | null
  }
```

### Step 10: ImageGrid 组件

**文件**: `frontend/src/nodes/image/ImageGrid.tsx`

```
Props:
  images: string[]  // 图片 URL 数组
  columns?: number  // 默认 2

布局 (2x2 网格):
  ┌──────┬──────┐
  │ img1 │ img2 │  ← 每格 8px 圆角
  ├──────┼──────┤  ← gap 4px
  │ img3 │ img4 │
  └──────┴──────┘

样式:
  - 图片 object-fit: cover
  - 每格正方形
  - Hover: opacity 0.8 + cursor pointer
  - 点击: 打开 ImageModal

生成中占位:
  - 每格灰色占位 + 进度百分比
  - 动画: pulse 效果
```

### Step 11: ImagePreview 组件

**文件**: `frontend/src/nodes/image/ImagePreview.tsx`

```
Props:
  imageUrl: string
  alt?: string

渲染:
  - 单张图片预览
  - 点击放大 (打开 ImageModal)
  - 下载按钮 (小图标)

样式:
  - 8px 圆角
  - object-fit: cover
  - max-height: 160px
```

### Step 12: ImageModal 放大预览

**文件**: `frontend/src/components/ImageModal.tsx`

```
使用 Radix UI Dialog

Props:
  imageUrl: string
  isOpen: boolean
  onClose: () => void

布局:
  ┌──────────────────────────────────────┐
  │                                 [×]  │
  │                                      │
  │          [大图预览]                   │
  │          居中显示                     │
  │          max 90vw × 85vh             │
  │                                      │
  │ [⬇ 下载]                             │
  └──────────────────────────────────────┘

样式:
  - 遮罩: rgba(0,0,0,0.8) 黑色半透明
  - 图片居中, 保持比例
  - 右上角关闭按钮
  - 左下角下载按钮 (#242424 主按钮)

下载逻辑:
  - 调用 GET /api/v1/assets/:id/download
  - 触发浏览器下载
  - 文件名: tanvas_{workflow_name}_{timestamp}.{ext}
  - 如果直接有 URL (MJ 生成等):
    - fetch → blob → createObjectURL → <a download>
```

### Step 13: ImageNode 通用组件

**文件**: `frontend/src/nodes/image/ImageNode.tsx`

```
Props:
  nodeType: "image_mj" | "image_imagen"
  title: string
  inputs: PortDef[]
  outputs: PortDef[]

通用配置区 (适用于 MJ 和 Imagen):
  - aspect_ratio: select 下拉
    选项: 1:1 / 16:9 / 9:16
  - speed_mode: select (MJ 专属)
    选项: 快速 / 标准
  - number_of_images: select (Imagen 专属)
    选项: 1 / 2 / 3 / 4
  - 高级控制 (折叠):
    - negative_prompt: textarea
    - seed: number input

结果区:
  - 未执行: "点击 Run 生成" 灰色占位
  - 执行中: ImageGrid 显示 4 格灰色占位 + 进度百分比
  - 成功: ImageGrid 显示生成图片
  - 失败: 红色错误信息

单图下载:
  - 在 ImageModal 中提供下载按钮
```

### Step 14: MidjourneyV7Node 和 Imagen3Node

**文件**: `frontend/src/nodes/image/MidjourneyV7Node.tsx`

```
使用 ImageNode 通用组件
传入 nodeType="image_mj", title="Midjourney V7"
inputs: [{ id: "prompt", type: "prompt" }, { id: "image", type: "image" (可选参考图) }]
outputs: [{ id: "image", type: "image" }]
配置: 显示 speed_mode, 隐藏 number_of_images
```

**文件**: `frontend/src/nodes/image/Imagen3Node.tsx`

```
使用 ImageNode 通用组件
传入 nodeType="image_imagen", title="Imagen 3"
inputs: [{ id: "prompt", type: "prompt" }]
outputs: [{ id: "image", type: "image" }]
配置: 隐藏 speed_mode, 显示 number_of_images
```

### Step 15: 节点注册表更新

**文件**: `frontend/src/nodes/index.ts` — 修改

```
添加:
  image_mj: MidjourneyV7Node
  image_imagen: Imagen3Node
  image_upload: ImageUploadNode

NODE_DEFINITIONS 添加:
  image_mj: {
    type: "image_mj", label: "Midjourney V7", icon: "🎨",
    description: "使用 MJ V7 生成图片",
    category: "image",
    defaultData: { aspectRatio: "1:1", speedMode: "fast", negativePrompt: "", seed: null },
    inputs: [{ id: "prompt", type: "prompt" }, { id: "image", type: "image" }],
    outputs: [{ id: "image", type: "image" }],
  }
  image_imagen: { ... }
  image_upload: { ... }
```

### Step 16: 后端注册路由

**文件**: `backend/app/main.py` — 修改

```python
from app.api.v1 import assets
app.include_router(assets.router, prefix="/api/v1/assets", tags=["assets"])
```

---

## 验收清单

- [ ] `POST /api/v1/assets/upload` 上传图片成功，存储到 MinIO
- [ ] 上传文件格式校验: 仅 JPG/PNG/WebP，超过 20MB 拒绝
- [ ] `GET /api/v1/assets/:id/download` 生成签名 URL 可下载
- [ ] 不能下载其他用户的私有图片（404）
- [ ] ImageUploadNode: 拖拽上传正常
- [ ] ImageUploadNode: Ctrl+V 粘贴图片上传正常
- [ ] 文件过大/格式不对前端即时提示
- [ ] 上传中显示进度条
- [ ] MidjourneyV7Node: 输入 prompt，成功生成 4 张图片
- [ ] MJ 节点支持参考图片输入
- [ ] MJ 节点 aspect_ratio/speed_mode 配置正常
- [ ] Imagen3Node: 输入 prompt，生成 1-4 张图片
- [ ] Imagen 节点 number_of_images 配置正常
- [ ] 生成图片显示 2×2 网格预览
- [ ] 生成中显示灰色占位 + 进度
- [ ] 点击图片弹出 ImageModal 放大预览
- [ ] ImageModal 中下载按钮正常工作
- [ ] 生成图片保存到 MinIO 永久存储
- [ ] 刷新浏览器后图片仍可访问
- [ ] 负向提示词和种子值配置正常
- [ ] MJ API 队列满时显示友好提示
- [ ] 内容违规时显示 "不符合内容政策" 提示
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 6
- [ ] phase1-mvp.md → Slice 5 ✅
- [ ] git commit: "Slice 5: image nodes (MJ V7 + Imagen 3) + MinIO storage + upload"
