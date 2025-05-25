#!/bin/bash

# build.sh - Build script to handle TypeScript compilation issues

set -e  # Exit on any error

echo "🏗️  Building Gutter Portal project..."

# Step 1: Clean any previous builds
echo "🧹 Cleaning previous builds..."
rm -rf packages/shared/dist
rm -rf worker/dist
rm -rf notification/dist
rm -rf payment/dist
rm -rf frontend/dist

# Step 2: Install dependencies if needed
echo "📦 Installing dependencies..."
pnpm install

# Step 3: Build shared package first
echo "🔧 Building shared package..."
cd packages/shared
pnpm run build
cd ../..

# Step 4: Build worker
echo "🔧 Building worker..."
cd worker
echo "   - Running TypeScript compilation check..."
npx tsc --noEmit --skipLibCheck
echo "   - Worker TypeScript check passed ✅"
cd ..

# Step 5: Build notification worker
echo "🔧 Building notification worker..."
cd notification
echo "   - Running TypeScript compilation check..."
npx tsc --noEmit --skipLibCheck
echo "   - Notification worker TypeScript check passed ✅"
cd ..

# Step 6: Build payment worker
echo "🔧 Building payment worker..."
cd payment
echo "   - Running TypeScript compilation check..."
npx tsc --noEmit --skipLibCheck
echo "   - Payment worker TypeScript check passed ✅"
cd ..

# Step 7: Build frontend
echo "🔧 Building frontend..."
cd frontend
echo "   - Running TypeScript compilation check..."
npx tsc --noEmit --skipLibCheck
echo "   - Building frontend assets..."
pnpm run build
echo "   - Frontend build completed ✅"
cd ..

echo "🎉 Build completed successfully!"
echo ""
echo "To deploy:"
echo "  pnpm run deploy"
echo ""
echo "To start development:"
echo "  pnpm run dev"
