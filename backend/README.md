# SkyPath Backend

Spring Boot backend for the SkyPath 3D visualization project.

## Tech Stack
- Java 17
- Spring Boot 3.2.0
- Spring Data MongoDB
- MongoDB
- Maven

## Prerequisites
- Java 17 or higher
- Maven 3.6+
- MongoDB running on localhost:27017

## Project Structure
```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/skypath/backend/
│   │   │   ├── SkyPathBackendApplication.java  # Main application class
│   │   │   ├── config/                          # Configuration classes
│   │   │   │   ├── CorsConfig.java
│   │   │   │   └── MongoDBConfig.java
│   │   │   ├── controller/                      # REST Controllers
│   │   │   │   ├── UserController.java
│   │   │   │   └── ProjectController.java
│   │   │   ├── service/                         # Business logic
│   │   │   │   ├── UserService.java
│   │   │   │   ├── ProjectService.java
│   │   │   │   └── KPICalculatorService.java
│   │   │   ├── repository/                      # Data access layer
│   │   │   │   ├── UserRepository.java
│   │   │   │   ├── ProjectRepository.java
│   │   │   │   ├── ObjDataRepository.java
│   │   │   │   └── WaypointRepository.java
│   │   │   ├── entity/                         # MongoDB entities
│   │   │   │   ├── User.java
│   │   │   │   ├── Project.java
│   │   │   │   ├── ObjData.java
│   │   │   │   └── Waypoint.java
│   │   │   └── dto/                            # Data Transfer Objects
│   │   │       ├── KPIMetrics.java
│   │   │       └── WaypointData.java
│   │   └── resources/
│   │       └── application.properties          # Application configuration
│   └── test/
└── pom.xml
```

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `GET /api/users/email/{email}` - Get user by email
- `POST /api/users` - Create a new user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Projects
- `GET /api/projects?userId={userId}` - Get all projects for a user
- `GET /api/projects/{id}` - Get project by ID
- `POST /api/projects` - Create a new project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `POST /api/projects/{id}/waypoints` - Save waypoints for a project
- `POST /api/projects/{id}/kpi` - Calculate KPI metrics for a project

## Running the Application

### Option 1: Using Maven
```bash
cd backend
mvn spring-boot:run
```

### Option 2: Using Maven package
```bash
cd backend
mvn clean package
java -jar target/backend-1.0.0.jar
```

### Option 3: Using IDE
Import the project as a Maven project in your IDE (IntelliJ IDEA, Eclipse, etc.) and run `SkyPathBackendApplication.java`.

## Configuration

Edit `src/main/resources/application.properties` to configure:
- Server port (default: 8080)
- MongoDB connection URI
- CORS allowed origins
- Logging levels

## MongoDB Setup

### 开发环境（推荐：使用 Docker）

```bash
# 在项目根目录
docker-compose up -d

# 或使用启动脚本
start-mongodb.bat  # Windows
./start-mongodb.sh # macOS/Linux
```

MongoDB 将在 `localhost:27017` 运行

### 生产环境（使用 MongoDB Atlas）

1. 按照 [MongoDB Atlas 设置指南](../MONGODB_ATLAS_SETUP.md) 设置
2. 配置环境变量：
```bash
export SPRING_PROFILES_ACTIVE=prod
export MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skypath
```
3. 启动应用：
```bash
mvn spring-boot:run
```

### 验证 MongoDB 连接

```bash
# 本地 Docker
docker-compose ps mongodb

# 或使用 MongoDB Shell
docker exec -it skypath-mongodb mongosh skypath
```

详细设置请参考：[MongoDB Atlas 设置指南](../MONGODB_ATLAS_SETUP.md)

## Development

### Adding a new API endpoint
1. Create/update DTO in `dto/` package
2. Add repository method in `repository/` package
3. Add service method in `service/` package
4. Add controller endpoint in `controller/` package

### Running tests
```bash
mvn test
```

## Performance Optimization

The KPI calculation is performed on the backend to:
- Reduce frontend computational load
- Enable faster calculations with server-side optimizations
- Allow future parallel processing improvements
- Enable caching of calculations

## License
See LICENSE file in the root directory.
