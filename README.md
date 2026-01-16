# API 余额查询工具

一个优雅的 AI 平台余额查询工具，支持 AIPing 和硅基流动，基于 Vue 3 + Element Plus 构建。

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Element Plus](https://img.shields.io/badge/Element%20Plus-2.9-409EFF)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)

## ✨ 特性

- 🎨 粒子动效背景（随平台切换变色）
- 💫 流畅的入场动画和过渡效果
- 🔐 API Key 安全输入（支持显示/隐藏）
- 📊 余额分类展示（总余额、充值余额、赠送余额）
- 📱 响应式设计，移动端友好
- 🔄 支持多平台切换（AIPing / 硅基流动）
- 📋 批量查询功能（支持最多 50 个 Key）
- 📈 批量查询结果汇总统计

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📖 使用说明

1. 启动项目后访问 http://localhost:3000
2. 选择要查询的平台（AIPing 或 硅基流动）
3. 选择查询模式（单个查询 或 批量查询）
4. 输入对应平台的 API Key
5. 点击「查询余额」按钮

### 批量查询

- 每行输入一个 API Key
- 最多支持 50 个 Key 同时查询
- 自动汇总所有成功查询的总余额

## 🔧 技术栈

- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 组件库
- [VueUse Motion](https://motion.vueuse.org/) - Vue 动画库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Axios](https://axios-http.com/) - HTTP 客户端

## 📝 支持的平台

### AIPing
- API Key 格式：`QC-xxxxxxxx-xxxxxxxxxxxx`
- [官网](https://aiping.cn)

### 硅基流动 (SiliconFlow)
- API Key 格式：`sk-xxxxxxxxxxxxxxxx`
- [官网](https://siliconflow.cn)

## 🚀 部署

支持腾讯云 EdgeOne Pages 部署，已配置 Edge Functions 处理 CORS。

构建命令：`npm run build`
输出目录：`dist`

## 📄 License

本项目采用 [GPL-3.0](LICENSE) 许可证开源。
