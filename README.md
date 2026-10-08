# 拾念 · 思维导图

一个轻量、手机和电脑都能打开的中文思维导图 Web App。支持本地使用，也可配置 Supabase 账号同步。

## 当前功能

- 新建、重命名和切换多张导图
- 添加子主题和同级主题，双击主题即可编辑
- 拖动画布、缩放、适应画布、折叠分支
- 撤销和重做
- 自动保存在当前浏览器
- 导出 JSON 备份，导入拾念 JSON 文件
- 可安装为手机或电脑上的 PWA；缓存已访问过的应用资源，便于离线打开
- 配置 Supabase 后支持邮箱账号登录、跨设备云端同步和在线更新
- 云端脑图支持嵌套文件夹、目录导航、移动与两种文件夹删除方式
- 已登录后可验证旧密码并修改密码；通过 Magic Link 首次设置密码时，旧密码可留空

## 运行

在此目录启动任意静态 HTTP 服务，然后用浏览器访问其本地地址。例如安装了 Python 时运行：

```sh
python dev_server.py
```

再访问 `http://localhost:8000`。PWA 安装和 Service Worker 需要 HTTPS 或 localhost。直接双击 HTML 可以预览主要界面，但浏览器可能限制离线缓存。

Supabase 邮箱确认重定向也要配置：Dashboard → Authentication → URL Configuration，将 Site URL 设为 `http://localhost:8000`，并把 `http://localhost:8000/**` 加入 Redirect URLs。部署上线后，再将公开网站地址加入 Redirect URLs。

## 启用云同步

1. 创建 Supabase 项目。
2. 在 Supabase Dashboard 的 SQL Editor 运行 [`supabase/schema.sql`](supabase/schema.sql)。升级现有项目时也要重新执行；脚本会新增 `folders` 表和 `mindmaps.folder_id`，并配置账号隔离的 RLS、文件夹归属校验和目录 Realtime。旧脑图的 `folder_id` 为空，会显示在根目录。
3. 部署者在项目 API 设置中取得 Project URL 和公开 `anon` key；不要使用 `service_role` key。
4. 本地开发时可在应用「设置 → Supabase 云端配置」内填写这些值。生产部署则通过 `SHINIAN_SUPABASE_URL`、`SHINIAN_SUPABASE_ANON_KEY` 在构建时注入，普通用户打开网页后无需再配置 Supabase。
5. 用户在应用内创建邮箱账号并登录。其他设备访问同一个已部署网址、使用相同邮箱账号，即可加载该账号的云端导图。

当前的 SQL 策略为每个登录账号隔离数据。基础公开分享需在 Supabase SQL Editor 额外执行 [`supabase/shares.sql`](supabase/shares.sql)，该脚本可重复执行并为匿名访客开放仅限已分享且未删除记录的读取。邮箱注册可能需要先完成 Supabase 发来的邮箱验证。

公开分享链接使用 `/share/{share_id}`。部署时将 `supabase-public-config.js` 中的 `url` 与 `anonKey` 填为 Supabase Project URL 和公开 anon key（不要填 service_role）；静态托管需支持 `/share/*` 回退到 `index.html`，项目提供了 `_redirects` 和 `vercel.json` 示例。标准 `python -m http.server` 不支持该路径回退；本地公开链接需使用支持 SPA 回退的静态服务器。

## 静态构建与公网部署

项目无需常驻 Node 后端。`scripts/build.mjs` 将 HTML、CSS、浏览器端 JS、PWA 文件和路由配置复制到 `dist/`，并把 Supabase **公开 anon/publishable key** 注入静态配置；`service_role` 密钥绝不能放入前端。当前代码直接通过 Supabase JS 客户端访问 Auth 和数据库，浏览器中的 Supabase URL 与 anon key 是公开客户端配置，数据保护由现有 RLS 策略承担。构建不会执行 SQL 或修改数据库表。

Supabase Storage 用于托管和分发文件，不提供这个项目所需的 SPA 路由回退；Storage 对 HTML 文件也会按纯文本返回。应用静态资源因此部署到支持 HTTPS 和 `/share/{share_id}` 回退的静态网站托管平台，Supabase 继续负责 Auth、Postgres 和 Storage。[Supabase Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart) [Supabase 文件分发文档](https://supabase.com/docs/guides/storage/serving/downloads)

### 构建

在 PowerShell 中设置公开 Supabase 项目配置并构建：

```powershell
$env:SHINIAN_SUPABASE_URL = 'https://你的项目.supabase.co'
$env:SHINIAN_SUPABASE_ANON_KEY = '你的公开 anon key'
node .\scripts\build.mjs --require-config
```

也可以把这两个变量放入本机未提交的 `.env.production`。仅把公开 anon/publishable key 放在构建变量中，不要使用 `service_role`。输出目录是 `dist/`，可部署到任意支持 SPA fallback 的静态主机。

### Vercel 部署示例

Supabase 本身不负责发布静态 SPA。Vercel CLI 示例会部署 `dist/`，`dist/vercel.json` 将 `/share/{id}` 重写到应用入口：

```powershell
npx vercel login
.\deploy-vercel.ps1
```

部署脚本会构建、首次交互关联 Vercel 项目并发布 `dist/`，随后输出公网 HTTPS 地址。Vercel 项目关联信息会在后续构建时保留。首次部署前先配置 Supabase URL 和公开 anon key 环境变量。Vercel 支持从 CLI 部署指定目录。[Vercel CLI 部署文档](https://vercel.com/docs/cli/deploy)

随后在 Supabase Dashboard → Authentication → URL Configuration 中将正式公网地址设为 Site URL，并将 `http://localhost:8000/**`、正式站点地址下的 `/**` 加入 Redirect URLs。Supabase 邮箱验证要求这些回调地址与允许列表匹配。[Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

邮箱注册和登录已由网页内 Supabase Auth 界面处理；RLS 应保持 `owner_id = auth.uid()` 的既有账号隔离策略。匿名用户可以继续使用本机脑图，登录后可点击本地列表中的「迁移到云端」，将本地文件夹、脑图和收藏标记迁入当前账号。分享链接按当前页面 `location.origin` 生成，所以 localhost 开发链接与线上域名自动区分。

部署版包含 PWA manifest、Service Worker 和安装按钮。静态应用外壳支持缓存后离线打开；云同步、公开分享读取和首次加载的 CDN 第三方库仍需要网络。

本地开发继续运行：

```powershell
python .\dev_server.py
```

访问 `http://localhost:8000`。本地 Supabase 配置仍可在应用设置中填写；使用本地分享预览时，需本地静态服务器支持 `/share/*` 回退。

Supabase 当前提供免费额度，适合个人试用；免费项目在一周无活动后会暂停，恢复前云同步可能暂不可用。请定期使用“导出备份”。[查看 Supabase 官方价格与免费计划](https://supabase.com/pricing)。

