# 直播运营中心 · LiveOps Console

跨境电商直播复盘与诊断看板（单文件静态应用，可直接部署到 GitHub Pages）。

## 功能
- 登录鉴权 + 三级权限（总负责人 / 店长 / 只读）
- 数据看板（月度大盘 + 品类/基地/国家维度）
- 直播复盘（单店周期诊断 + 大盘定位 + 卡点方案）
- 标杆/问题直播间盘点
- 周维度诊断
- AI 知识库（DeepSeek 大模型 + 内置直播知识库）

## 部署到 GitHub Pages
1. 把本目录（含 `index.html`）推送到 GitHub 仓库的 `main` 分支
2. 仓库 `Settings → Pages → Build and deployment`：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main`、目录选 `/ (root)`
   - 保存
3. 等待约 1 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`

## 默认账号
| 账号 | 密码 | 角色 |
|---|---|---|
| 江奇文 | 749182388 | 总负责人 |
| editor | ops123 | 店长（ZHOKA） |
| viewer | view123 | 店长（PolyFurnish） |

## 安全说明
- 密码以 SHA-256 哈希存储，不存明文
- 数据仅限组内使用，请勿将仓库设为公开（见部署文档安全提醒）
