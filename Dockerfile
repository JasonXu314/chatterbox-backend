FROM node:17

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

ENV PORT=5000

RUN yarn build

EXPOSE 5000

CMD ["yarn", "start:prod"]