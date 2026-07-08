#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Building React frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Installing Python backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

echo "Deployment build completed successfully!"
