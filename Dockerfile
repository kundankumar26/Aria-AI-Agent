# Step 1 — Choose base image
# Official Node.js 20 on lightweight Alpine Linux
FROM node:20-alpine

# Step 2 — Set working directory inside container
# All commands after this run inside /app
WORKDIR /app

# Step 3 — Copy package files first
# We copy these separately to leverage Docker cache
# If package.json hasn't changed, Docker skips npm install
COPY package*.json ./

# Step 4 — Install dependencies
RUN npm install --production

# Step 5 — Copy rest of the code
COPY . .

# Step 6 — Tell Docker your app runs on port 3000
EXPOSE 3000

# Step 7 — Command to start the app
CMD ["node", "server.js"]