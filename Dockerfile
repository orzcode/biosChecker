# Use Playwright's official image with dependencies pre-installed
FROM mcr.microsoft.com/playwright:focal

# Copy package.json and package-lock.json separately for better caching
COPY package*.json ./

# Install dependencies
RUN npm install && \
    npx playwright install --with-deps --no-shell

# Set the command to start the server
CMD ["node", "app.js"]
