# Kenshin App

This app manages your health checkup schedule and results. Built with FastAPI, PostgreSQL, GraphQL, and Remix.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually comes with Docker Desktop)
- [Node.js](https://nodejs.org/) (version 18 or later)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Getting Started

### Backend Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd kenshin
```

2. Start the backend using Docker Compose:
```bash
docker-compose up --build
```

The backend will be available at:
- GraphQL Playground: http://localhost:8000/graphql
- API Documentation: http://localhost:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:3000

## Docker Commands

```bash
# Start the backend in detached mode
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

## Development

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
├── frontend/              # Frontend Remix application
│   ├── app/              # Application source code
│   │   ├── routes/       # Route components
│   │   ├── styles/       # CSS styles
│   │   └── root.tsx      # Root component
│   ├── public/           # Static assets
│   └── package.json      # Node.js dependencies
├── docker-compose.yml     # Docker Compose configuration
└── README.md             # This file
```

## Backend API Examples

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

## Environment Variables

### Backend (configured in docker-compose.yml)

- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name

### Frontend (.env file in frontend directory)

- `API_URL`: Backend API URL (default: http://localhost:8000)

## Available Gender Options

The application supports the following gender options:
- `MALE`
- `FEMALE`
- `OTHER`