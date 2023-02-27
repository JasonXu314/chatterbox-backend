FROM node:17

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

ENV PORT=8888

RUN yarn build

EXPOSE 8888

CMD ["yarn", "start:prod"]