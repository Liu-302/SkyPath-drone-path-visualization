# SkyPath 3D Visualization Project

A full-stack 3D visualization application for drone path planning and building inspection.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

SkyPath is an interactive 3D web application designed for drone flight path planning and building inspection. It enables users to:

- Upload and visualize 3D building models (OBJ format)
- Create and edit drone flight paths with waypoints
- Real-time KPI calculation (coverage, overlap, energy, collision detection)
- Visualize camera viewpoints and frustums
- Undo/Redo functionality for path editing

## 🛠 Tech Stack

### Frontend
- **Framework**: Vue 3 with Composition API
- **3D Engine**: Three.js + TresJS
- **State Management**: Pinia
- **Build Tool**: Vite (via FesJS)
- **Styling**: SCSS
- **TypeScript**: Full type safety

### Backend
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Database**: MongoDB
- **ORM**: Spring Data MongoDB
- **Build Tool**: Maven

## ✨ Features

### Core Features
- **3D Visualization**: Interactive 3D building models with drone path visualization
- **Path Planning**: Create and edit drone flight paths with waypoints
- **Real-time KPI Calculation**: Instant feedback on path modifications
  - Coverage percentage
  - Overlap detection
  - Energy consumption estimation
  - Collision detection
- **Camera Views**: Visualize camera frustums and viewpoints
- **Undo/Redo**: Full history support with keyboard shortcuts (Ctrl+Z, Ctrl+Y)

### User Experience
- Drag and drop file upload
- Particle loading animation
- Intuitive 3D camera controls
- Responsive design
- Real-time validation with English error messages

## Project Structure

```
grp-skypath/
├── frontend/                      # Vue.js frontend application
│   ├── src/
│   │   ├── features/             # Feature modules
│   │   │   ├── kpi/           # KPI calculation and display
│   │   │   ├── upload/         # File upload and model loading
│   │   │   ├── visualization/  # 3D visualization
│   │   │   └── shared/        # Shared components
│   │   ├── pages/              # Page components
│   │   ├── stores/             # Pinia stores
│   │   ├── shared/             # Global utilities and constants
│   │   └── styles/            # Global styles
│   ├── public/                 # Static assets
│   ├── package.json           # Dependencies
│   ├── tsconfig.json         # TypeScript config
│   └── README.md            # Frontend documentation
│
├── backend/                       # Spring Boot backend application
│   ├── src/main/java/com/skypath/backend/
│   │   ├── config/            # Configuration (CORS, MongoDB)
│   │   ├── controller/        # REST API controllers
│   │   ├── service/           # Business logic
│   │   ├── repository/        # Data access layer
│   │   ├── entity/            # MongoDB entities
│   │   └── dto/              # Data transfer objects
│   ├── src/main/resources/
│   │   └── application.properties  # App configuration
│   ├── pom.xml              # Maven configuration
│   ├── README.md            # Backend documentation
│   └── API_EXAMPLES.md      # API usage examples
│
├── .gitignore
├── .editorconfig
├── LICENSE
├── README.md               # This file
├── 项目结构说明.md          # Chinese structure documentation
└── 默认数据配置表.md        # Data configuration reference
```

## Prerequisites

### Frontend
- **Node.js**: 18+
- **Package Manager**: Yarn (recommended) or npm
- **Browser**: Chrome, Firefox, Safari, or Edge (latest version)

### Backend
- **Java**: 17+
- **Maven**: 3.6+
- **MongoDB**: 5.0+

## Quick Start

### 方式 1：使用本地 Docker MongoDB（开发推荐）

#### 1. 启动 MongoDB

```bash
# Windows
start-mongodb.bat

# macOS/Linux
chmod +x start-mongodb.sh
./start-mongodb.sh

# 或直接使用 Docker Compose
docker-compose up -d
```

MongoDB 将在 `localhost:27017` 运行

#### 2. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端将在 `http://localhost:8080` 运行

#### 3. 启动前端

```bash
cd frontend

# Install dependencies (first time only)
yarn install

# Start development server
yarn dev
```

前端将在 `http://localhost:8000` 运行

### 方式 2：使用 MongoDB Atlas（生产环境）

1. 按照 [MongoDB Atlas 设置指南](./MONGODB_ATLAS_SETUP.md) 设置 MongoDB Atlas
2. 创建 `.env.prod` 文件并配置连接字符串
3. 启动后端：
```bash
cd backend
set SPRING_PROFILES_ACTIVE=prod
set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skypath
mvn spring-boot:run
```

详细设置步骤请参考：[MongoDB Atlas 设置指南](./MONGODB_ATLAS_SETUP.md)

## Documentation

- **[Frontend Documentation](./frontend/README.md)** - Detailed frontend architecture and development guide
- **[Backend Documentation](./backend/README.md)** - Backend API reference and architecture
- **[API Examples](./backend/API_EXAMPLES.md)** - Example API calls and responses
- **[项目结构说明.md](./项目结构说明.md)** - Chinese project structure documentation
- **[默认数据配置表.md](./默认数据配置表.md)** - Data configuration reference

## Development

### Frontend Development

```bash
cd frontend
yarn dev
```

The development server runs at `http://localhost:8000` with hot reload enabled.

#### Key Files to Edit
- `src/pages/Visualize.vue` - Main visualization page
- `src/features/kpi/` - KPI calculation and display
- `src/features/visualization/` - 3D rendering components
- `src/stores/` - Pinia state management

### Backend Development

```bash
cd backend
mvn spring-boot:run
```

The backend runs at `http://localhost:8080`.

#### Key Files to Edit
- `src/main/java/com/skypath/backend/controller/` - Add new API endpoints
- `src/main/java/com/skypath/backend/service/` - Implement business logic
- `src/main/java/com/skypath/backend/repository/` - Add data access methods
- `src/main/resources/application.properties` - Configure MongoDB and CORS

## Deployment

### Frontend Deployment

```bash
cd frontend
yarn build
```

The static files will be built in the `dist/` directory. Deploy to any static web server (Nginx, Apache, Vercel, etc.).

### Backend Deployment

```bash
cd backend
mvn clean package
java -jar target/backend-1.0.0.jar
```

For production deployment, consider:
- Using a reverse proxy (Nginx)
- Enabling HTTPS
- Setting up process management (systemd, PM2)
- Configuring MongoDB replica sets for high availability

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Frontend: Follow Vue 3 Style Guide
- Backend: Follow Spring Boot conventions
- Use meaningful commit messages
- Write tests for new features

## License

This project is licensed under the terms of the [LICENSE](LICENSE) file.

## Acknowledgments

- **Three.js** - 3D rendering engine
- **Vue.js** - Progressive JavaScript framework
- **Spring Boot** - Java application framework
- **MongoDB** - NoSQL database

## Contact

For questions or support, please open an issue on GitHub.

---
