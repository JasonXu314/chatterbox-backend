## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn dev

# production mode
$ yarn start:prod
```

## Endpoints

```
POST /signup
Body {
	username: string
	password: string
}
Response {
	id: number
	username: string
	token: string
}
```

```
POST /login
Body {
	username: string
	password: string
}
Response {
	id: number
	username: string
	token: string
}
```

```
GET /users
GET /users?id=number
GET /users/[id: number]
Response {
	id: string
	username: string
}
```

```
POST /create-message
Body {
	channelId: number
	content: string
	token: string
}
Response {
	id: number
	channelId: number
	authorId: number
	content: string
	createdAt: Date
}
```

## Test

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

