# 快速开始指南

## 前置要求

- Java 17+
- Maven 3.6+
- Node.js 18+
- Docker Desktop（已安装）

## 第一步：启动 Docker Desktop

**重要**：确保 Docker Desktop 正在运行！

1. 打开 Docker Desktop 应用
2. 等待 Docker 完全启动（状态栏显示 "Docker Desktop is running"）
3. 如果还没安装，请访问：https://www.docker.com/products/docker-desktop/

## 第二步：启动 MongoDB（使用 Docker）

在项目根目录运行：

```bash
# Windows
start-mongodb.bat

# macOS/Linux
chmod +x start-mongodb.sh
./start-mongodb.sh

# 或直接使用 Docker Compose
docker-compose up -d
```

**验证 MongoDB 是否运行**：
```bash
docker-compose ps
```

应该看到 `skypath-mongodb` 状态为 `Up`

## 第三步：启动后端

```bash
cd backend
mvn spring-boot:run
```

后端将在 `http://localhost:8080` 启动

**验证后端是否正常**：
- 查看控制台，应该看到 "Started SkyPathBackendApplication"
- 没有 MongoDB 连接错误

## 第四步：启动前端

```bash
cd frontend

# 首次运行需要安装依赖
yarn install

# 启动开发服务器
yarn dev
```

前端将在 `http://localhost:8000` 启动

## 完成！

现在你可以：
1. 打开浏览器访问 `http://localhost:8000`
2. 上传 OBJ 文件
3. 开始使用！

## 常用命令

### MongoDB 管理

```bash
# 启动 MongoDB
docker-compose up -d mongodb

# 停止 MongoDB
docker-compose stop mongodb

# 查看 MongoDB 日志
docker-compose logs -f mongodb

# 重置 MongoDB 数据（删除所有数据）
docker-compose down -v

# 进入 MongoDB Shell
docker exec -it skypath-mongodb mongosh skypath
```

### 后端管理

```bash
# 启动后端（开发环境）
cd backend
mvn spring-boot:run

# 启动后端（生产环境 - 使用 MongoDB Atlas）
cd backend
set SPRING_PROFILES_ACTIVE=prod
set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skypath
mvn spring-boot:run
```

## 故障排查

### 问题 1：Docker 连接失败

**错误**：`The system cannot find the file specified`

**解决**：
1. 确保 Docker Desktop 正在运行
2. 重启 Docker Desktop
3. 检查 Docker Desktop 状态栏

### 问题 2：MongoDB 启动失败

**错误**：端口 27017 已被占用

**解决**：
```bash
# 检查端口占用
netstat -ano | findstr :27017  # Windows
lsof -i :27017  # macOS/Linux

# 停止占用端口的进程，或修改 docker-compose.yml 中的端口
```

### 问题 3：后端连接 MongoDB 失败

**错误**：`Connection refused` 或 `Cannot connect to MongoDB`

**解决**：
1. 确保 MongoDB 容器正在运行：`docker-compose ps`
2. 检查 MongoDB 日志：`docker-compose logs mongodb`
3. 确保使用 `dev` profile（默认）

### 问题 4：前端无法连接后端

**错误**：CORS 错误或网络错误

**解决**：
1. 确保后端正在运行（`http://localhost:8080`）
2. 检查 `application.properties` 中的 CORS 配置
3. 确保前端访问的是 `http://localhost:8000`

## 下一步

- 查看 [MongoDB Atlas 设置指南](./MONGODB_ATLAS_SETUP.md)（生产环境）
- 查看 [项目结构说明](./项目结构说明.md)
- 查看 [API 示例](./backend/API_EXAMPLES.md)
