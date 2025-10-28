#!/bin/bash

# Medicine Alternative Finder - Database Setup Script
# This script sets up the PostgreSQL database for the medicine alternative finder

echo "🏥 Setting up Medicine Alternative Finder Database..."

# Check if PostgreSQL is running (Docker or local)
if ! pg_isready -h localhost -p 5432 -q; then
    echo "❌ PostgreSQL is not running on localhost:5432"
    echo ""
    echo "If you're using Docker, make sure your PostgreSQL container is running:"
    echo "   docker ps | grep postgres"
    echo "   docker start <postgres-container-name>"
    echo ""
    echo "If you're using local PostgreSQL:"
    echo "   brew services start postgresql  # On macOS with Homebrew"
    echo "   sudo systemctl start postgresql # On Linux"
    echo "   net start postgresql-x64-13     # On Windows"
    exit 1
fi

echo "✅ PostgreSQL is running on localhost:5432"

# Database configuration
DB_NAME="medicine_db"
DB_USER="postgres"
DB_PASSWORD="4324"
DB_HOST="localhost"
DB_PORT="5432"

echo "📊 Creating database '$DB_NAME'..."

# Create database if it doesn't exist
PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || echo "Database already exists"

echo "📋 Running database schema..."

# Run the SQL schema
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f base.sql

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
    echo "   - Check container logs: docker logs <postgres-container-name>"
    echo "   - Verify port mapping: docker port <postgres-container-name>"
    exit 1
fi
