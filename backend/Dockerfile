FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production || npm install --production

# Copy app source
COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]
