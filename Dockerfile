FROM node:20-bookworm

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json separately for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all remaining files
COPY . .

# Install Playwright dependencies
RUN npx -y playwright install --with-deps --no-shell

# Start the app
CMD ["node", "app.js"]
