FROM node:17

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

RUN mysqld

CMD ["yarn", "start:prod"]