# Use official Node image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first and install dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy application code
WORKDIR /app
COPY . .

# Expose port and define start command
EXPOSE 3000
WORKDIR /app/backend
CMD ["npm", "run", "start:prod"]
