FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY ./dist ./dist

RUN apk add --no-cache docker-cli

EXPOSE 8080

CMD ["node", "dist/index.js"]
