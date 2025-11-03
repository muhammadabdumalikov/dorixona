#!/bin/bash

# Medicine Alternative Finder - Database Setup Script
# This script sets up the PostgreSQL database for the medicine alternative finder

echo "🏥 Setting up Medicine Alternative Finder Database..."

# Check if PostgreSQL Docker container is running
if ! docker ps | grep -q postgres; then
    echo "❌ PostgreSQL Docker container is not running"
    echo ""
    echo "Please start your PostgreSQL Docker container:"
    echo "   docker ps -a | grep postgres  # Check if container exists"
    echo "   docker start <postgres-container-name>  # Start existing container"
    echo ""
    echo "Or create a new PostgreSQL container:"
    echo "   docker run --name postgres-db -e POSTGRES_PASSWORD=4324 -p 5432:5432 -d postgres:13"
    exit 1
fi

echo "✅ PostgreSQL Docker container is running"

# Database configuration
DB_NAME="medicine_db"
DB_USER="postgres"
DB_PASSWORD="4324"
DB_HOST="localhost"
DB_PORT="5432"

echo "📊 Creating database '$DB_NAME'..."

# Get the PostgreSQL container name
POSTGRES_CONTAINER=$(docker ps | grep postgres | awk '{print $1}' | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ Could not find PostgreSQL container"
    exit 1
fi

echo "Using PostgreSQL container: $POSTGRES_CONTAINER"

# Create database if it doesn't exist
docker exec $POSTGRES_CONTAINER createdb -U $DB_USER $DB_NAME 2>/dev/null || echo "Database already exists"

echo "📋 Running database schema..."

# Run the SQL schema using Docker
docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME < base.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Update .env file with: DATABASE_URL=\"postgresql://postgres:4324@localhost:5432/medicine_db\""
    echo "   2. Start the application: npm run start:dev"
    echo "   3. Import data: npm run import:data"
    echo "   4. View API docs: http://localhost:3000/api/docs"
    echo "   5. Check database status: npm run db:status"
else
    echo "❌ Database setup failed. Please check the error messages above."
    echo ""
    echo "Common Docker issues:"
    echo "   - Make sure PostgreSQL container is running: docker ps"
    echo "   - Check container logs: docker logs $POSTGRES_CONTAINER"
    echo "   - Verify port mapping: docker port $POSTGRES_CONTAINER"
    echo "   - Check if base.sql file exists in current directory"
    echo "   - Verify database permissions: docker exec $POSTGRES_CONTAINER psql -U postgres -c '\\l'"
    exit 1
fi
