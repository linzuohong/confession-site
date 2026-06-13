# STATUS · 表白网站

> 由 ranmao-design 系统手工搭建。引擎从零编写，遵循燃猫设计全部核心原则。

## 项目信息
- **创建日期**：2026-06-13
- **预览**：`cd confession-site && python3 -m http.server 8099`
- **部署**：见 ranmao-design/DEPLOY.md（GitHub + Vercel + 自定义域名）

## 已实现

### 设计令牌
- [x] 强调色 #D9341C（朱砂红）+ 中性灰三档 + 纯黑底
- [x] 字号 ≤6 档、间距一套刻度
- [x] 字体分工：英雄 Noto Sans SC 900 子集 / 正文 PingFang / 数字 Space Grotesk

### 结构（BASELINE 骨架）
- [x] 开幕 Gate（点击门 + BGM 同手势）
- [x] 短叙事（4 章，每章 3-5 句）
- [x] 英雄大字告白（纯白实心 900）
- [x] 诗意收尾 + CTA（联系方式复制）

### 特效
- [x] Gate 粒子场（暖红微光 + 偶现心形）
- [x] 情绪节点场（fx.js 星座连线）
- [x] 英雄大字蓄能→迸发动效（P25 改编：暖红光晕 → 心形粒子辐射 → 纯白落定）
- [x] 分段慢揭示 + stagger（P7）
- [x] 章节打字机式入场
- [x] 幕间分隔线 + 菱形（P12）
- [x] 静态胶片颗粒 + 暗角（P17）

### 工程
- [x] 中文断行系统（P37：cjkWbr + keep-all + balance）
- [x] 动效纯函数 f(progress)
- [x] 内容 token 化（data.js 唯一配置点）
- [x] 跨文件 window.* 暴露 + 兜底
- [x] 降级路径：reduced-motion / 无 JS / 触屏

### 收尾
- [x] favicon SVG data-URI（零 404）
- [x] BGM 占位 mp3
- [x] og 分享卡 meta 标签
- [x] console 零消息
- [x] 移动端适配（640px 断点）

## 待办（用户自行完成）
1. [ ] 替换 BGM：audio/bgm.mp3 → 真正的背景音乐
2. [ ] 修改文案：js/data.js → 改成你自己的名字和故事
3. [ ] 填联系方式：js/data.js finale.contact → 微信/电话
4. [ ] 替换 og:image：生成 1200×630 品牌分享卡（见 P40）
5. [ ] 部署上线：按 DEPLOY.md 走 GitHub + Vercel 流程
6. [ ] 真机测试：至少一台移动设备过一遍完整流程

## 沉淀来源
- 2026-06-13 燃猫设计系统落地：TASTE 否决词典全遵守 / BASELINE 审计表全通过 / P37 中文断行系统 / P25 蓄能迸发改编
