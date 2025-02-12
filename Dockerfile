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
RUN npx -y playwright@1.50.1 install --with-deps --no-shell

# Expose 8000
EXPOSE 8000

# Start the app
CMD ["node", "app.js"]
