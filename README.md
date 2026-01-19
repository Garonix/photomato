# Photomato

**专注于视觉体验的极简图片管理应用。**

Photomato 是一个基于 Go 和 React 开发的图片管理应用，注重浏览体验与性能，旨在提供轻量、流畅的现代图库解决方案。

## 功能特点

- **极简设计**: 移除冗余 UI 元素，通过沉浸式布局最大化图片展示区域。
- **流畅动效**: 提供平滑的过渡动画与自然的手势交互体验。
- **高效体验**: 提供自适应网格布局与无损灯箱查看模式。

## 界面预览

### 画廊视图
自适应网格布局，支持懒加载与快速滚动。

![图片画廊预览](docs/images/gallery_preview.png)

### 灯箱模式
全屏查看模式，支持缩放、平移及手势切换图片。

![灯箱预览](docs/images/lightbox_preview.png)

### 相册管理
支持创建相册与图片归档整理。

![相册管理预览](docs/images/albums_preview.png)

### 系统设置
提供可视化的存储源管理与系统参数配置。

![设置界面预览](docs/images/settings_preview.png)

## 技术栈

- **后端**: Go (Golang)
- **前端**: React, Vite, Tailwind CSS
- **数据**: SQLite (元数据) + Local/S3 (文件存储)

## 快速开始

### 环境准备
- Go 1.22+
- Node.js 18+

### 启动服务
1. **后端**: (配置 `app-config.yaml` 后运行)
   ```bash
   go run cmd/server/main.go
   ```
2. **前端**:
   ```bash
   cd web && npm install && npm run dev
   ```