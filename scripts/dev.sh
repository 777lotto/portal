#!/bin/bash
# Development startup script for the Gutter Portal project

echo "🚀 Starting Gutter Portal Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install it first.${NC}"
    exit 1
fi

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
pnpm install

# Build shared package first
echo -e "${YELLOW}🔨 Building shared package...${NC}"
cd packages/shared && pnpm run build && cd ../..

# Start all services in the background
echo -e "${GREEN}🏃 Starting services...${NC}"

# Kill any existing processes on our ports
lsof -ti:8787 | xargs kill -9 2>/dev/null || true
lsof -ti:8788 | xargs kill -9 2>/dev/null || true
lsof -ti:8789 | xargs kill -9 2>/dev/null || true
lsof -ti:8790 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start workers
echo -e "${GREEN}  → Starting Main API Worker (port 8787)...${NC}"
cd worker && pnpm run dev &
WORKER_PID=$!
cd ..

echo -e "${GREEN}  → Starting Notification Worker (port 8789)...${NC}"
cd notification && pnpm run dev --port 8789 &
NOTIFICATION_PID=$!
cd ..

echo -e "${GREEN}  → Starting Payment Worker (port 8790)...${NC}"
cd payment && pnpm run dev --port 8790 &
PAYMENT_PID=$!
cd ..

# Wait a bit for workers to start
sleep 3

# Start frontend with Vite
echo -e "${GREEN}  → Starting Frontend (port 5173)...${NC}"
cd frontend && pnpm run dev &
FRONTEND_PID=$!
cd ..

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $WORKER_PID $NOTIFICATION_PID $PAYMENT_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Wait for all services to be ready
echo -e "\n${GREEN}✅ All services started!${NC}"
echo -e "\n📍 Service URLs:"
echo -e "  Frontend:     ${GREEN}http://localhost:5173${NC}"
echo -e "  Main API:     ${GREEN}http://localhost:8787${NC}"
echo -e "  Notification: ${GREEN}http://localhost:8789${NC}"
echo -e "  Payment:      ${GREEN}http://localhost:8790${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Keep script running
while true; do
    sleep 1
done
