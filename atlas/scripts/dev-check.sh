#!/bin/bash

# 開発品質管理スクリプト - 毎回必須実行
set -e

echo "🔧 Development Quality Check Starting..."
echo "======================================"

# 1. TypeScript型チェック
echo "📝 Checking TypeScript..."
if ! bun --bun tsc --noEmit; then
    echo "❌ TypeScript errors found!"
    exit 1
fi
echo "✅ TypeScript check passed"

# 2. Biome linting & formatting
echo "🧹 Running Biome check..."
if ! bun run lint; then
    echo "❌ Biome errors found!"
    exit 1
fi
echo "✅ Biome check passed"

# 3. Build test
echo "🏗️  Testing build..."
if ! bun run build; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"

# 4. Clean up build artifacts
echo "🧽 Cleaning up build artifacts..."
rm -rf out/
rm -rf .next/
echo "✅ Build artifacts cleaned"

# 5. Run AI Improvement Engine
echo "🤖 Running AI Improvement Suggestions..."
bun ./scripts/ai-improvement-engine.js

# 6. Start dev server
echo "🚀 Starting development server..."
echo "======================================"
echo "✨ All checks passed! Starting dev server..."
bun run dev