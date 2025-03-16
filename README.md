# Kenshin App

This app manages your health checkup schedule and results. Built with FastAPI, PostgreSQL, and GraphQL.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually comes with Docker Desktop)

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd kenshin
```

2. Start the application using Docker Compose:
```bash
docker-compose up --build
```

The application will be available at:
- GraphQL Playground: http://localhost:8000/graphql
- API Documentation: http://localhost:8000/docs

## Docker Commands

```bash
# Start the application in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Stop the application and remove volumes (clean state)
docker-compose down -v

# Rebuild and start the application
docker-compose up --build
```

## API Examples

### Create a User

```graphql
mutation {
  createUser(userData: {
    name: "John Doe"
    email: "john@example.com"
    birthday: "1990-01-01"
    gender: MALE
  }) {
    id
    name
    email
    birthday
    gender
  }
}
```

### Get All Users

```graphql
query {
  getAllUsers {
    id
    name
    email
    birthday
    gender
  }
}
```

### Create a Test Set

```graphql
mutation {
  createTestSet(
    testSetData: {
      userId: 1
      itemId: 1
      frequency: 30
      nextDate: "2024-04-15"
    }
  ) {
    id
    frequency
    nextDate
    user {
      name
      email
    }
  }
}
```

## Project Structure

```
kenshin/
├── api/                    # Backend API directory
│   ├── Model/             # Database models
│   ├── Repository/        # Data access layer
│   ├── Service/          # Business logic
│   ├── Graphql/          # GraphQL schemas and resolvers
│   ├── requirements.txt   # Python dependencies
│   └── main.py           # FastAPI application entry point
├── docker-compose.yml     # Docker Compose configuration
└── README.md             # This file
```

## Environment Variables

The application uses the following environment variables (configured in docker-compose.yml):

- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name