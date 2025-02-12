# Use Playwright's official image with dependencies pre-installed
FROM node:20-bookworm

RUN npx playwright install --with-deps --no-shell

# Copy package.json and package-lock.json separately for better caching
ADD . .

# Set the command to start the server
CMD ["node", "app.js"]
