# AIPing 余额查询

一个优雅的 AIPing 平台余额查询工具，基于 Vue 3 + Element Plus 构建。

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Element Plus](https://img.shields.io/badge/Element%20Plus-2.9-409EFF)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)

## ✨ 特性

- 🎨 粒子动效背景
- 💫 流畅的入场动画
- 🔐 API Key 安全输入（支持显示/隐藏）
- 📊 余额分类展示（总余额、充值余额、赠送余额）
- 📱 响应式设计，移动端友好

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
2. 输入你的 AIPing API Key（格式：`QC-xxxxxxxx-xxxxxxxxxxxx`）
3. 点击「查询余额」按钮

## 🔧 技术栈

- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 组件库
- [VueUse Motion](https://motion.vueuse.org/) - Vue 动画库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Axios](https://axios-http.com/) - HTTP 客户端

## 📝 API 文档

基于 [AIPing 官方 API](https://aiping.cn)：

```
GET https://aiping.cn/api/v1/user/remain/points
Authorization: Bearer <your-api-key>
```

响应示例：
```json
{
  "code": 0,
  "msg": "OK",
  "data": {
    "gift_remain": 10.5,
    "recharge_remain": 89.5,
    "total_remain": 100.0
  }
}
```

## 📄 License

GPL-3.0 许可证
