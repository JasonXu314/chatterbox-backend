FROM node:17

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY knexfile.ts ./

RUN mkdir migrations
RUN mkdir seeds

COPY migrations/* ./migrations/
COPY seeds/* ./seeds/

RUN echo $NODE_ENV

RUN yarn install

COPY . .

ENV PORT=8888

RUN yarn build

EXPOSE 8888

CMD ["yarn", "start:prod"]