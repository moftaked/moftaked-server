FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN mkdir -p uploads/images

EXPOSE 3000

CMD ["npm", "run", "dev"]