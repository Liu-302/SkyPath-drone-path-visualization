#!/bin/bash

echo "========================================"
echo "Starting MongoDB with Docker..."
echo "========================================"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "ERROR: Docker is not running"
    echo "Please start Docker Desktop first"
    exit 1
fi

# Start MongoDB
docker-compose up -d mongodb

echo ""
echo "MongoDB is starting..."
echo "Waiting for MongoDB to be ready..."

# Wait for MongoDB to be ready
sleep 5

# Check if MongoDB is running
docker-compose ps mongodb

echo ""
echo "========================================"
echo "MongoDB is running on localhost:27017"
echo "========================================"
echo ""
echo "To stop MongoDB: docker-compose stop mongodb"
echo "To view logs: docker-compose logs -f mongodb"
echo "To reset data: docker-compose down -v"
echo ""
