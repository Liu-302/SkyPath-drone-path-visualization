# API Usage Examples

## Base URL
```
http://localhost:8080
```

## Auth Operations

### Register
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```
返回 `token` 和 `userId`，后续请求需在 Header 中携带 `Authorization: Bearer {token}`。

## Project Operations

### Create a new project（需登录）
```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "My 3D Building Project",
    "userId": "{userId}"
  }'
```

### Get all projects for a user
```bash
curl "http://localhost:8080/api/projects?userId={userId}"
```

### Save waypoints for a project
```bash
curl -X POST http://localhost:8080/api/projects/{projectId}/waypoints \
  -H "Content-Type: application/json" \
  -d '[
    {
      "x": 0.0,
      "y": 100.0,
      "z": 0.0,
      "normalX": 0.0,
      "normalY": -1.0,
      "normalZ": 0.0
    },
    {
      "x": 10.0,
      "y": 105.0,
      "z": 10.0,
      "normalX": 0.0,
      "normalY": -1.0,
      "normalZ": 0.0
    }
  ]'
```

### Calculate KPI metrics
```bash
curl -X POST http://localhost:8080/api/projects/{projectId}/kpi
```

Example response:
```json
{
  "pathLength": 14.14,
  "flightTime": 0.94,
  "coverage": 100.0,
  "overlap": 100.0,
  "collisionCount": 0,
  "hasCollision": false,
  "energy": 0.29,
  "status": "completed",
  "progress": 100
}
```

## Testing with Postman

Import the following collection to Postman:

### Environment Variables
```
baseUrl = http://localhost:8080
userId = <copy from user creation response>
projectId = <copy from project creation response>
```

## Integration with Frontend

The frontend should send requests to the backend API for:
1. Saving/loading projects and user data
2. Calculating KPI metrics (offloaded to backend for better performance)

Example frontend integration:
```javascript
// Calculate KPIs on backend
async function calculateKPIs(projectId) {
  const response = await fetch(`http://localhost:8080/api/projects/${projectId}/kpi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await response.json();
}
```
