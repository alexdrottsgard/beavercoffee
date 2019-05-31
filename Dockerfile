FROM node:10-alpine

RUN mkdir /app && chown -R node:node /app

WORKDIR /app

COPY .env app.js package-lock.json package.json queries.js ./

USER node

RUN npm install

EXPOSE 8080

CMD npm start
