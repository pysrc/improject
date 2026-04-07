# 即时通讯系统 (IM)

一个基于 Vue 3 + Express + SQLite 的全栈即时通讯系统，支持私聊、群聊、音视频通话等功能。

## ✨ 功能特性

### 用户功能
- 🔐 用户注册/登录（JWT 认证）
- 👤 个人信息管理（头像、密码修改）
- 👥 好友管理（添加、删除、备注）

### 聊天功能
- 💬 私聊消息（文本、图片、文件、语音）
- 👨‍👩‍👧‍👦 群聊功能
  - 创建群组
  - 邀请成员（需管理员审核）
  - 群成员管理（群主/管理员/成员三级权限）
  - @提及功能
- 📁 文件传输（图片、文档、压缩包等）
- 🔊 新消息语音提醒
- 📷 图片预览放大

### 音视频通话
- 📞 音频通话
- 📹 视频通话
- 🖥️ 屏幕共享
- 🌐 WebRTC 点对点通信

### 界面体验
- 🎨 现代化渐变主题界面
- 📱 响应式设计
- ✨ 流畅动画效果
- 🌙 支持自定义主题

## 🛠️ 技术栈

### PC端前端
- **框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **UI 组件**: Naive UI
- **样式**: Scoped CSS + 渐变主题
- **实时通信**: Server-Sent Events (SSE)
- **音视频**: WebRTC

### 移动端前端
- **框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **UI 组件**: Vant 4
- **样式**: Scoped CSS + 渐变主题
- **实时通信**: Server-Sent Events (SSE)
- **音视频**: WebRTC

### 后端
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: SQLite3
- **认证**: JWT (JSON Web Token)
- **文件存储**: 本地文件系统

## 📁 项目结构

```
improject/
├── im-front/                # PC端前端项目
│   ├── src/
│   │   ├── api/            # API 接口
│   │   ├── components/     # Vue 组件
│   │   ├── stores/         # Pinia 状态管理
│   │   ├── utils/          # 工具函数
│   │   └── views/          # 页面视图
│   ├── public/             # 静态资源
│   └── vite.config.js      # Vite 配置
│
├── im-front-mobile/        # 移动端前端项目
│   ├── src/
│   │   ├── api/            # API 接口
│   │   ├── components/     # Vue 组件
│   │   ├── stores/         # Pinia 状态管理
│   │   ├── utils/          # 工具函数
│   │   └── views/          # 页面视图
│   └── vite.config.js      # Vite 配置
│
├── im-server/              # 后端项目
│   ├── server.js           # 主服务文件
│   ├── uploads/            # 文件上传目录
│   │   ├── avatars/        # 头像存储
│   │   └── chat/           # 聊天文件存储
│   ├── im.db               # SQLite 数据库
│   └── package.json
│
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd improject
```

2. **安装后端依赖**
```bash
cd im-server
npm install
```

3. **安装PC端前端依赖**
```bash
cd ../im-front
npm install
```

4. **安装移动端前端依赖**
```bash
cd ../im-front-mobile
npm install
```

5. **配置环境变量**

创建 `im-server/.env` 文件：
```env
PORT=3001
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# WebRTC TURN 服务器配置（可选）
TURN_URLS=turn:your-server:3478
TURN_SECRET=your-turn-secret
TURN_EXPIRY=3600
```

5. **启动后端服务**
```bash
cd im-server
npm start
```

6. **启动PC端前端开发服务器**
```bash
cd im-front
npm run dev
```

7. **启动移动端前端开发服务器**
```bash
cd im-front-mobile
npm run dev
```

8. **访问应用**

- PC端: `https://localhost:5173`
- 移动端: `https://localhost:5174`


## 📄 许可证

MIT License

## 👨‍💻 作者

pysrc

## 🙏 致谢

- [Vue.js](https://vuejs.org/)
- [Naive UI](https://www.naiveui.com/)
- [Express.js](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)
