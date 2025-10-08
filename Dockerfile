# Use an official Node.js runtime as a parent image
FROM node:22-bookworm-slim AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install build dependencies like bcrypt that don't exist in alpine
# RUN apk add --no-cache python3 make g++

# Install application dependencies
RUN --mount=type=cache,target=/root/.npm \
     npm ci

# Copy the rest of the application code to the working directory
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port your Express app listens on
EXPOSE 4000

# Define the command to run your application
CMD [ "node", "dist/server.js" ]