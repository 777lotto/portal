#!/bin/bash

# debug.sh - Quick debug script to identify build issues

echo "🔍 Debugging build issues..."

# Check if shared package builds
echo "📦 Testing shared package..."
cd packages/shared
if pnpm run build; then
    echo "✅ Shared package builds successfully"
else
    echo "❌ Shared package has build errors"
    echo "This needs to be fixed first!"
    exit 1
fi
cd ../..

# Check worker TypeScript
echo "🔧 Testing worker TypeScript..."
cd worker
echo "Current directory: $(pwd)"
echo "TypeScript config exists: $(ls -la tsconfig.json 2>/dev/null || echo 'NOT FOUND')"

if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Worker TypeScript compiles successfully"
else
    echo "❌ Worker has TypeScript errors"
    echo "Running again with more details..."
    npx tsc --noEmit --skipLibCheck --pretty
fi
cd ..

echo "🏁 Debug complete"
