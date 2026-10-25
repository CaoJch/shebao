# 贺州 · 社保规划（个人测算工具 · 轻量小程序风）

纯静态页面，无后端、无数据库、不采集上传任何个人信息。外观为青绿渐变轻量小程序风。

---

## 一、本地预览（上传前先看看效果）

- 最简单：双击 `index.html` 用浏览器打开
- 或用命令：

```bash
cd CaoJch
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

---

## 二、链接是怎么来的（先看这个，别填错）

部署到 GitHub Pages 后，最终链接形如：

```
https://caojch.github.io/shebao/
        ↑ 用户名(决定)        ↑ 仓库名(决定)
```

- **`caojch`**：您在 GitHub 注册时填的**用户名**，决定链接第一段
- **`shebao`**：您新建的**仓库名**，决定链接第二段
- 因此：**用户名必须填 `CaoJch`**，仓库名填 `shebao`，链接才是上面这个

---

## 三、详细部署步骤（网页操作，无需命令行）

### 第 1 步：注册 GitHub 账号
1. 浏览器打开 https://github.com
2. 点右上角 **Sign up**（注册）；可右下角切换中文
3. 填写：Email、Password、**Username 填 `CaoJch`**（关键）、完成验证
4. 去邮箱点确认链接，注册完成

> 这一步必须本人做（需手机/邮箱验证），无法代注册。

### 第 2 步：新建仓库
1. 登录后点右上角 **+** → **New repository**
2. Repository name 填 `shebao`；Visibility 选 **Public**（免费版要求公开）；不要勾 Add README
3. 点 **Create repository**

### 第 3 步：上传文件（推荐网页拖拽）
1. 进入刚建的 `shebao` 空仓库
2. 点 **"uploading an existing file"**
3. 把本文件夹里的全部内容拖入上传区：
   - `index.html`、`favicon.png`、`README.md`
   - `assets` 文件夹（连同里面 4 个文件一起拖，不能只拖散文件）
   - ⚠️ 注意：仓库根目录应直接看到 `index.html`，**不要把 `CaoJch` 整个文件夹拖进去**
4. 下拉到 Commit changes，填说明（如 initial），点提交

### 第 4 步：开启 GitHub Pages
1. 进仓库点 **Settings** → 左侧 **Pages**
2. Source 选 **"Deploy from a branch"**
3. Branch 选 **`main`**，目录选 **`/ (root)`**，点 Save

### 第 5 步：访问
等 1～3 分钟，浏览器打开：

**https://caojch.github.io/shebao/**

正常显示青绿渐变测算页即成功。

---

## 四、命令行方式（已为您初始化好 git，适合会用命令者）

本目录**已经 git init 并提交、remote 已指向 `CaoJch/shebao`**，您只需 push：

```bash
cd CaoJch
git branch -M main
git push -u origin main
# 首次 push 会要求输入 GitHub 用户名 + Personal Access Token（不是登录密码）
```

获取 Token：GitHub 右上角头像 → Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token，
勾 `repo` 权限，生成后复制保存（只显示一次）。
push 时 Password 处粘贴该 Token。

---

## 五、以后如何更新

- 改内容（如参数调整）：重新上传覆盖文件 → commit，约 1 分钟自动生效
- 若用命令行：改完 `git add . && git commit -m "update" && git push`

---

## 六、注意事项

| 项 | 说明 |
|---|---|
| 微信打开 | `github.io` 一般不在微信拦截名单，比 workbuddy 链接稳定；个别网络打不开时点「在浏览器打开」 |
| ICP 备案 | GitHub Pages 为国外服务，无需也无法国内备案；个人对外长期运营政务内容有合规提示，建议仅作个人演示/内部试用 |
| 自定义域名 | 以后想用 `caojch.com` 之类，在 Settings → Pages → Custom domain 填入即可，其他不动 |
| 费用 | GitHub Pages 对公开仓库永久免费，不限流量 |

---

## 七、文件结构

```
CaoJch/
├── index.html        # 主页面
├── favicon.png       # 图标
├── README.md         # 本说明
└── assets/
    ├── engine.js     # 测算引擎（金额逻辑集中在此文件的 CONFIG）
    ├── app.js        # 界面交互
    ├── style.css     # 基础样式
    └── themes.css    # 轻量小程序风主题
```

改测算参数（社平工资、缴费档次补贴等）只需编辑 `assets/engine.js` 顶部的 `CONFIG`。
