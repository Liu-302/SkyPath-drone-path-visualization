@echo off
echo ========================================
echo Starting MongoDB with Docker...
echo ========================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running
    echo Please start Docker Desktop first
    pause
    exit /b 1
)

REM Start MongoDB
docker-compose up -d mongodb

echo.
echo MongoDB is starting...
echo Waiting for MongoDB to be ready...

REM Wait for MongoDB to be ready
timeout /t 5 /nobreak >nul

REM Check if MongoDB is running
docker-compose ps mongodb

echo.
echo ========================================
echo MongoDB is running on localhost:27017
echo ========================================
echo.
echo To stop MongoDB: docker-compose stop mongodb
echo To view logs: docker-compose logs -f mongodb
echo To reset data: docker-compose down -v
echo.
pause
