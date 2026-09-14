#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
echo "Starting frontend and backend in this console..."
npm run dev
