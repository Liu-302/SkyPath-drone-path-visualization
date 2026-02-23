# SkyPath

全栈 3D 无人机航路规划与建筑巡检可视化应用。

## 功能概览

- **3D 可视化**：OBJ 建筑模型 + 无人机路径
- **航点编辑**：插入、删除、重排、撤销/重做
- **KPI 计算**：覆盖率、重叠率、能耗、碰撞检测
- **用户系统**：登录/注册，项目云端保存
- **项目管理**：Home 首页、新建/打开/重命名/删除项目

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TresJS + Three.js + Pinia + TypeScript |
| 后端 | Spring Boot 3.2 + Java 17 |
| 数据库 | MongoDB |
| 构建 | FesJS (Vite) / Maven |

## 前置要求

- **Java 17+**、**Maven 3.6+**
- **Node.js 18+**、**Yarn**
- **Docker Desktop**（用于本地 MongoDB）

## 快速开始

### 1. 启动 MongoDB

```bash
docker-compose up -d
```

验证：`docker-compose ps` 中 `skypath-mongodb` 为 `Up`。

### 2. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端运行于 `http://localhost:8080`。

### 3. 启动前端

```bash
cd frontend
yarn install    # 首次运行
yarn dev
```

前端运行于 `http://localhost:8000`。

### 4. 首次使用

1. 访问 `http://localhost:8000`，进入登录页
2. 点击 **Create Account** 注册（用户名、邮箱、密码至少 6 位）
3. 注册后自动登录，进入 **Home** 首页
4. 点击 **New Project** 新建项目，上传 OBJ 模型和 JSON 路径
5. 在可视化页面可编辑航点、查看 KPI、导出路径、保存到云端

## 服务地址

| 服务 | 地址 |
|------|------|
| MongoDB | `localhost:27017` |
| 后端 | `http://localhost:8080` |
| 前端 | `http://localhost:8000` |

## 项目结构

```
grp-skypath-new/
├── frontend/                 # Vue 前端
│   ├── src/
│   │   ├── features/         # 功能模块 (kpi, upload, visualization, shared)
│   │   ├── pages/            # 页面 (index, Login, Home, Upload, Visualize)
│   │   ├── stores/           # Pinia 状态
│   │   └── shared/           # 工具、服务、配置
│   └── package.json
├── backend/                  # Spring Boot 后端
│   ├── src/main/java/.../
│   │   ├── controller/      # AuthController, ProjectController
│   │   ├── service/          # 业务逻辑
│   │   ├── repository/      # 数据访问
│   │   └── entity/           # 实体
│   └── pom.xml
├── docker-compose.yml        # MongoDB 容器
└── README.md
```

## 常用命令

```bash
# 启动所有服务（需 3 个终端）
docker-compose up -d
cd backend && mvn spring-boot:run
cd frontend && yarn dev

# MongoDB 管理
docker-compose logs -f mongodb
docker exec -it skypath-mongodb mongosh skypath
```

## 故障排查

| 问题 | 处理 |
|------|------|
| Docker 连接失败 | 确保 Docker Desktop 已启动 |
| 端口 27017 被占用 | 运行 `netstat -ano` 查找占用进程并停止 |
| 后端连不上 MongoDB | 确认 `docker-compose ps` 中 MongoDB 为 Up |
| 前端 CORS 错误 | 确认后端已启动，检查 `application.properties` 中 CORS |
| 登录失败 | 旧版明文密码用户需重新注册 |

## 生产部署

- **MongoDB**：使用 MongoDB Atlas 或自建
- **JWT**：设置环境变量 `JWT_SECRET`（至少 32 字符）
- **前端**：构建时设置 `VITE_BACKEND_URL` 为后端地址
- **CORS**：设置 `CORS_ORIGINS` 包含前端域名

```bash
# 后端生产示例
set SPRING_PROFILES_ACTIVE=prod
set MONGODB_URI=mongodb+srv://...
set JWT_SECRET=your-secret-key
mvn spring-boot:run
```

## 相关文档

- [API 示例](./backend/API_EXAMPLES.md) - 接口调用示例
- [默认数据配置表](./默认数据配置表.md) - 相机、能耗、无人机等参数说明

## License

见 [LICENSE](./LICENSE) 文件。
