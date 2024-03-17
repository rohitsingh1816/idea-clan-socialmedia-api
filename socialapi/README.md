## What I've learned in this project

Basic & Advanced REST API Features

- Constructing API endpoints for a social media-esque web app (CRUD operations for posts & users)

Authentication in a REST API

- REST API server doesn't care about the client (requests are handled in isolation = no sessions)
- Authentication works differently - JSON Web Tokens used to store auth information on the client which prove auth status
- JWT are signed by the server and can only be validated by the server

Async-await

- Refactored our code to use this (cleaner in my opinion)

Websockets & Socket.io

GraphQL

- Stateless, client-independent API offering higher flexibility than REST APIs offer due to custom query language is exposes to the client.
- Only uses a single endpoint, POST to /graphql
