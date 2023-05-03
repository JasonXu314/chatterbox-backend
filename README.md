## Installation & Local Testing

### Requirements:

-   Node.js (https://nodejs.org/en) and Yarn (https://classic.yarnpkg.com/lang/en/)
-   MySQL local server (https://dev.mysql.com/downloads/)

### Running

Run

```bash
$ yarn install
```

to install dependencies, and

```bash
$ yarn dev
```

to run the local server

**_Make sure your MySQL server is running on port 3306 before running server_**

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
	avatar: string
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
	avatar: string
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
	avatar: string
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

```
POST /set-avatar
Body (FormData) {
	file: File
	token: string
}
Response string
```

```
GET /channels?token=string
Response {
	id: number
	name: string
	type: 'public' | 'direct'
}[]
```

```
GET /friends?token=string
Response {
	id: string
	username: string
	avatar: string
	channelId: string
}[]
```

```
POST /request-friend
Body {
	token: string
	id: number 		// the id of the request recipient
}
Response none
```

```
POST /accept-request
Body {
	token :string
	id: number		// the id of the requester
}
Response (the new friend) {
	id: string
	username: string
	avatar: string
	channelId: string
}
```

```
POST /friend-requests?token=string
Response {
	from: (the sending user) {
		id: number
		username: string
		avatar: string
	}
	timestamp: string
}[]
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

