CREATE TABLE users (
	id INT AUTO_INCREMENT,
	username VARCHAR(12),
	password VARCHAR(255) NOT NULL,
	salt VARCHAR(255) NOT NULL,
	token VARCHAR(255) NOT NULL UNIQUE,
	email VARCHAR(255) NOT NULL UNIQUE,
	avatar VARCHAR(255) NOT NULL,
	emailVerified BOOLEAN NOT NULL DEFAULT 0,
	status ENUM('ONLINE', 'OFFLINE', 'IDLE', 'DO_NOT_DISTURB', 'INVISIBLE') NOT NULL DEFAULT 'OFFLINE',
	PRIMARY KEY(id)
);

CREATE TABLE settings (
	id INT REFERENCES users,
	notifications ENUM('ALL', 'MESSAGES', 'FRIEND_REQ', 'NONE') NOT NULL DEFAULT 'ALL',
	lightMode BOOLEAN NOT NULL DEFAULT 0,
	PRIMARY KEY(id)
);

CREATE TABLE channels (
	id INT AUTO_INCREMENT,
	name VARCHAR(255) NOT NULL UNIQUE,
	type VARCHAR(255) NOT NULL DEFAULT 'public',
	PRIMARY KEY(id)
);

CREATE TABLE messages (
	id INT AUTO_INCREMENT,
	channelId INT REFERENCES channels(id),
	authorId INT REFERENCES users(id),
	content VARCHAR(2000) NOT NULL,
	createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(id)
);

CREATE VIEW user_view AS
SELECT id, username, avatar
FROM users;

CREATE TABLE channel_access (
	userId INT REFERENCES users(id),
	channelId INT REFERENCES channels(id),
	PRIMARY KEY(userId, channelId)
);

CREATE TABLE friend (
	sender INT REFERENCES users(id),
	recipient INT REFERENCES users(id),
	channelId INT REFERENCES channels(id),
	PRIMARY KEY(sender, recipient)
);

CREATE TABLE blocked (
	blocker INT REFERENCES users(id),
	blocked INT REFERENCES users(id),
	PRIMARY KEY(blocker, blocked)
);

CREATE TABLE friend_request (
	fromId INT REFERENCES users(id),
	toId INT REFERENCES users(id),
	requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(fromId, toId)
);

CREATE TABLE friend_notifications (
	user INT REFERENCES users(id),
	from INT REFERENCES users(id),
	to INT REFERENCES users(id),
	PRIMARY KEY(user, from, to)
);

CREATE TABLE message_notifications (
	user INT REFERENCES users(id),
	channelId INT REFERENCES channels(id)
	count INT NOT NULL,
	PRIMARY KEY(user, channelId)
);

INSERT INTO channels (name, type)
VALUES ('general', 'public'),
	   ('school', 'public'),
	   ('sports', 'public'),
	   ('gaming', 'public'),
	   ('politics', 'public');
