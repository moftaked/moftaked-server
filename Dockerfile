FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create uploads directory if it doesn't exist
RUN mkdir -p uploads/images

# Expose the port
EXPOSE 3000

# Install nodemon globally for development
RUN npm install -g nodemon

# Start the application with nodemon for hot reloading
CMD ["npm", "run", "dev"]