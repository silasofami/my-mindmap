# Git 远程仓库与 Vercel 部署指南（Windows PowerShell）

本文只涉及 Git 配置、首次提交和部署设置，不要求修改思维导图业务代码。

## 0. 当前仓库状态

本项目目录已经是 Git 仓库，当前默认分支为 `main`；首次提交和远程仓库尚未配置。无需重复运行 `git init`。项目根目录的 `.gitignore` 会排除依赖、构建输出、本机密钥文本、日志和系统文件，但会保留 HTML、JS、CSS、图片等源码。

首次提交前必须检查暂存清单。尤其不能提交 `项目supabase-key.txt`、`.env` 或任何含私钥的文件。Supabase `service_role` / secret key 绝不能放进前端或 Git。

## 1. 网页端创建空仓库

### GitHub

1. 登录 [GitHub](https://github.com/) ，点击右上角 `+` → **New repository**。
2. Repository name 填 `My-思维导图开发` 或其他名称，选择 Public / Private。
3. 初始化选项全部不勾：**Add a README file**、`.gitignore`、License。
4. 点击 **Create repository**，复制仓库 HTTPS 地址，例如 `https://github.com/用户名/仓库名.git`。

### Gitee

1. 登录 [Gitee](https://gitee.com/) ，点击右上角 `+` → **新建仓库**。
2. 填写仓库名称和可见性。
3. 不勾选初始化 README、许可证或 `.gitignore`，创建空仓库。
4. 复制仓库 HTTPS 地址，例如 `https://gitee.com/用户名/仓库名.git`。

## 2. 首次提交并推送（推荐交互脚本）

先在 PowerShell 检查 Git 已安装：

```powershell
git --version
Set-Location -LiteralPath 'D:\Users\石宏伟\ChatGPT\My-思维导图开发'
git status --short
git check-ignore -v -- '项目supabase-key.txt'
```

确认密钥文件显示为 ignored 后，运行脚本。脚本会先展示将提交的文件列表，并要求手动输入 `COMMIT` 才创建首次提交：

```powershell
Set-Location -LiteralPath 'D:\Users\石宏伟\ChatGPT\My-思维导图开发'
powershell -ExecutionPolicy Bypass -File '.\git-first-push.ps1' -Provider github
```

Gitee 则运行：

```powershell
Set-Location -LiteralPath 'D:\Users\石宏伟\ChatGPT\My-思维导图开发'
powershell -ExecutionPolicy Bypass -File '.\git-first-push.ps1' -Provider gitee
```

按提示粘贴刚才创建的空仓库 URL。脚本执行 `git add -A`、展示暂存文件、等待确认、创建 `Initial commit`、设置分支为 `main`、配置 `origin` 并执行 `git push -u origin main`。

如果脚本执行策略限制当前会话，也可直接使用 `-ExecutionPolicy Bypass` 运行，如上所示。不要把访问令牌写进脚本或仓库 URL；HTTPS 凭据应交给 Git Credential Manager 提示框处理。

## 3. 手动 Git 命令（GitHub / Gitee）

首次提交的通用命令：

```powershell
Set-Location -LiteralPath 'D:\Users\石宏伟\ChatGPT\My-思维导图开发'
git status --short
git check-ignore -v -- '项目supabase-key.txt'
git add -A
git diff --cached --name-only
git commit -m 'Initial commit'
git branch -M main
```

检查 `git diff --cached --name-only` 输出，确认没有密钥、`.env` 或个人数据后再 commit。

GitHub：

```powershell
git remote add origin 'https://github.com/用户名/仓库名.git'
git push -u origin main
```

Gitee：

```powershell
git remote add origin 'https://gitee.com/用户名/仓库名.git'
git push -u origin main
```

查看远程地址与状态：

```powershell
git remote -v
git status -sb
```

若 `origin` 已存在，改用 `git remote set-url origin '仓库URL'`，不要再次 `git remote add`。以后更新网站的常用流程：

```powershell
git add -A
git commit -m '描述本次修改'
git push
```

## 4. Vercel 绑定 GitHub 并自动部署

Vercel 的原生 Git 集成当前支持 GitHub、GitLab、Bitbucket 和 Azure DevOps。Gitee 不在原生导入列表中；如果仓库放在 Gitee，可用 Vercel CLI 从本机部署，或通过 CI 工作流触发部署，不能假设 Gitee push 会自动触发 Vercel Git 集成。

1. 登录 [Vercel](https://vercel.com/)。
2. 进入 **Add New… → Project**，在 **Import Git Repository** 中连接 GitHub 并授权。
3. 选择已推送的项目仓库，点击 **Import**。
4. 配置项目根目录为仓库根目录 `./`，Framework Preset 选 **Other**。

### 推荐的本项目生产构建配置

本仓库自带 `scripts/build.mjs`，构建会将 Supabase 公共配置写入静态产物 `dist/supabase-public-config.js`，并把 SPA 分享路由配置一并复制到产物中。要让部署站点能直接使用云端登录和分享预览，建议在 Vercel **Build and Output Settings** 设置：

| 设置项 | 值 |
|---|---|
| Framework Preset | Other |
| Root Directory | `./` |
| Build Command | `npm run build:production` |
| Output Directory | `dist` |
| Install Command | 留空（当前构建脚本无 npm 依赖） |

#### 环境变量（重点）

在项目 **Settings → Environment Variables** 增加以下两项，并至少勾选 **Production**；如果需要预览分支也访问云端，再勾选 **Preview**：

| Name | Value |
|---|---|
| `SHINIAN_SUPABASE_URL` | Supabase 项目的 HTTPS URL，例如 `https://xxxx.supabase.co` |
| `SHINIAN_SUPABASE_ANON_KEY` | Supabase 的公开 anon / publishable key |

只使用公开 anon / publishable key，绝不使用 `service_role`、secret key 或数据库密码。anon key 会随浏览器静态资源公开，数据安全必须由 Supabase Auth 与 RLS 策略保证。保存/修改环境变量后要重新部署，变量只会进入新的构建。

点击 **Deploy**。部署完成后使用 Vercel 提供的 `https://....vercel.app` 域名验证首页、登录及 `/share/{share_id}` 分享预览。后续 GitHub 仓库每次 push 到已连接分支，Vercel 会自动构建和部署。

### 如果坚持“无构建命令、输出目录 ./”

用户要求的纯静态配置可以设为 Framework **Other**、Root Directory `./`、Build Command 留空、Output Directory `./`、Install Command 留空。但纯静态托管不会在浏览器运行时自动读取 Vercel 环境变量；本项目根目录的 `supabase-public-config.js` 是空配置。因此即使在 Vercel 设置上述环境变量，云端配置也不会自动注入，云端登录和分享预览可能不可用。若采用此模式，必须另有安全的构建步骤生成公共配置；不要把密钥直接硬编码进业务源码。对当前仓库，推荐使用前述 `build:production` + `dist` 配置。

## 5. Gitee 仓库部署到 Vercel 的选择

- **最简单、自动部署**：把代码推送到 GitHub，再按上节导入 GitHub 仓库。
- **继续使用 Gitee**：安装并登录 Vercel CLI，构建后运行 `vercel` / `vercel --prod`；每次推送 Gitee 后需由本机或 CI 再运行部署命令。电脑关机不影响已部署的网站，但本机不会代替 CI 自动响应 Gitee push。

Vercel 官方说明：未列出的 Git provider 可通过 CLI 部署。请在使用 CLI 前确认 Vercel 项目与环境变量已配置，并避免把凭据提交到 Git。

## 6. 相关官方文档

- [Vercel Git 部署](https://vercel.com/docs/git)
- [Vercel 环境变量](https://vercel.com/docs/environment-variables)
- [Vercel 构建配置](https://vercel.com/docs/builds)
- [Vercel CLI 部署](https://vercel.com/docs/cli)
