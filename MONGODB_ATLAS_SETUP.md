# MongoDB Atlas 设置指南

## 📋 概述

本指南将帮助你设置 MongoDB Atlas 免费层，用于生产环境部署。

## 🎯 为什么使用 MongoDB Atlas？

- ✅ **免费层**：512MB 存储，适合初期项目
- ✅ **自动备份**：每日自动备份，数据安全
- ✅ **高可用**：自动故障转移，服务稳定
- ✅ **全球部署**：可选择最近的区域
- ✅ **安全加密**：默认启用 TLS/SSL 加密

## 📝 设置步骤

### 1. 创建 MongoDB Atlas 账号

1. 访问 https://www.mongodb.com/cloud/atlas/register
2. 使用邮箱注册，或使用 Google/GitHub 账号登录
3. 验证邮箱（如果需要）

### 2. 创建免费集群

1. 登录后，点击 **"Build a Database"** 或 **"Create"**
2. 选择 **FREE (M0)** 套餐（免费层）
3. 选择云服务商和区域：
   - **推荐**：选择离你最近的区域（如 `AWS / ap-southeast-1` 新加坡）
   - 注意：某些区域可能不支持免费层，选择有 "FREE" 标记的
4. 集群名称：`SkyPath-Cluster`（或自定义）
5. 点击 **"Create Cluster"**
6. 等待 3-5 分钟，集群创建完成

### 3. 创建数据库用户

1. 在左侧菜单点击 **"Database Access"**
2. 点击 **"Add New Database User"**
3. 认证方式：选择 **"Password"**
4. 用户名：`skypath-user`（或自定义）
5. 密码：
   - 点击 **"Autogenerate Secure Password"** 生成强密码
   - **⚠️ 重要**：复制并保存密码，后面要用！
   - 或自己设置强密码（至少 12 位，包含大小写字母、数字、特殊字符）
6. 用户权限：选择 **"Atlas admin"**（或 "Read and write to any database"）
7. 点击 **"Add User"**

### 4. 配置网络访问

1. 在左侧菜单点击 **"Network Access"**
2. 点击 **"Add IP Address"**

#### 开发/测试环境：
- 点击 **"Add Current IP Address"**（添加你的当前 IP）
- 或点击 **"Allow Access from Anywhere"**（`0.0.0.0/0`）
  - ⚠️ 注意：仅用于开发测试，生产环境建议使用 IP 白名单

#### 生产环境：
- 添加服务器 IP 地址
- 或添加 IP 范围（CIDR 格式）
- **不要**使用 "Allow Access from Anywhere"（安全风险）

3. 点击 **"Confirm"**

### 5. 获取连接字符串

1. 在左侧菜单点击 **"Database"**
2. 点击 **"Connect"** 按钮
3. 选择 **"Connect your application"**
4. Driver：选择 **"Java"**
5. Version：选择 **"5.0 or later"**
6. 复制连接字符串，格式如下：
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/skypath?retryWrites=true&w=majority
   ```
7. **重要**：将 `<username>` 替换为步骤 3 创建的用户名
8. **重要**：将 `<password>` 替换为步骤 3 创建的密码
9. 最终格式示例：
   ```
   mongodb+srv://skypath-user:MyPassword123@skypath-cluster.mongodb.net/skypath?retryWrites=true&w=majority
   ```

### 6. 配置项目

#### 方式 1：使用环境变量（推荐）

1. 复制 `.env.prod.example` 为 `.env.prod`：
   ```bash
   # Windows
   copy .env.prod.example .env.prod
   
   # macOS/Linux
   cp .env.prod.example .env.prod
   ```

2. 编辑 `.env.prod`，填入 MongoDB Atlas 连接字符串：
   ```bash
   SPRING_PROFILES_ACTIVE=prod
   MONGODB_URI=mongodb+srv://skypath-user:MyPassword123@skypath-cluster.mongodb.net/skypath?retryWrites=true&w=majority
   CORS_ORIGINS=https://yourdomain.com
   LOG_LEVEL=INFO
   ```

#### 方式 2：直接修改配置文件

编辑 `backend/src/main/resources/application-prod.properties`：
```properties
spring.data.mongodb.uri=mongodb+srv://skypath-user:MyPassword123@skypath-cluster.mongodb.net/skypath?retryWrites=true&w=majority
```

### 7. 启动应用

#### 开发环境（本地 Docker）：
```bash
# 启动 MongoDB
docker-compose up -d

# 启动后端（自动使用 dev profile）
cd backend
mvn spring-boot:run
```

#### 生产环境（MongoDB Atlas）：
```bash
# Windows
cd backend
set SPRING_PROFILES_ACTIVE=prod
set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skypath
mvn spring-boot:run

# macOS/Linux
cd backend
export SPRING_PROFILES_ACTIVE=prod
export MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skypath
mvn spring-boot:run
```

### 8. 验证连接

1. 启动后端应用
2. 查看控制台日志，应该看到：
   ```
   Connected to MongoDB Atlas cluster
   ```
   或
   ```
   MongoDB connection established
   ```
3. 如果没有错误，说明连接成功！

## 🔍 常见问题

### Q: 连接失败，提示 "authentication failed"
**A:** 
- 检查用户名和密码是否正确
- 确保在连接字符串中正确替换了 `<username>` 和 `<password>`
- 注意：密码中的特殊字符需要 URL 编码（如 `@` 需要编码为 `%40`）

### Q: 连接失败，提示 "IP not whitelisted"
**A:** 
- 在 MongoDB Atlas 的 "Network Access" 中添加你的 IP 地址
- 如果 IP 经常变化，可以临时添加 `0.0.0.0/0`（仅用于开发）

### Q: 如何查看数据库中的数据？
**A:** 
- 在 MongoDB Atlas 控制台，点击 "Database" → "Browse Collections"
- 可以查看所有集合和数据

### Q: 免费层有什么限制？
**A:** 
- **存储**：512MB
- **RAM**：共享（与其他免费用户共享）
- **适合**：开发、测试、小规模应用（< 100 用户）
- **不适合**：大规模生产环境

### Q: 如何升级到付费版本？
**A:** 
- 在 Atlas 控制台，点击集群 → "Edit Configuration"
- 选择更高配置（M10, M30 等）
- 按需付费，可以随时升级或降级

### Q: 如何备份数据？
**A:** 
- MongoDB Atlas 免费层提供每日自动备份
- 在 "Backup" 页面可以查看和恢复备份
- 也可以手动导出数据

## 🔒 安全建议

1. **不要提交密码到 Git**
   - 使用 `.env.prod` 文件（已添加到 `.gitignore`）
   - 不要将连接字符串提交到代码仓库

2. **使用强密码**
   - 至少 12 位
   - 包含大小写字母、数字、特殊字符
   - 定期更换密码

3. **限制 IP 访问**
   - 生产环境不要使用 "Allow Access from Anywhere"
   - 只添加必要的 IP 地址

4. **启用加密**
   - MongoDB Atlas 默认启用传输加密（TLS/SSL）
   - 确保连接字符串使用 `mongodb+srv://`（自动加密）

5. **定期备份**
   - 虽然 Atlas 有自动备份，但重要数据建议额外备份
   - 可以定期导出数据到本地

## 📚 相关资源

- [MongoDB Atlas 官方文档](https://docs.atlas.mongodb.com/)
- [Spring Data MongoDB 文档](https://spring.io/projects/spring-data-mongodb)
- [MongoDB 连接字符串格式](https://docs.mongodb.com/manual/reference/connection-string/)

## 🎉 完成！

设置完成后，你的项目就可以使用 MongoDB Atlas 了！

- **开发环境**：使用本地 Docker（快速、隔离）
- **生产环境**：使用 MongoDB Atlas（稳定、备份、高可用）
