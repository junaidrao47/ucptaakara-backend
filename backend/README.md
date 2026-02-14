# UCP-TAKRA Backend API

A production-ready Node.js/Express backend with JWT authentication, role-based access control, MongoDB, Redis caching, and Docker support.

## Features

- **JWT Authentication** - Secure token-based auth with 7-day expiration
- **MongoDB Integration** - Mongoose ODM with user schema
- **Redis Caching** - Response caching with TTL support
- **Docker Support** - Complete containerization setup
- **Password Hashing** - Bcrypt with 10 salt rounds
- **Role-Based Access Control** - user, moderator, admin roles
- **Input Validation** - Comprehensive validation with error messages
- **MVC Architecture** - Clean separation of concerns

## Project Structure

```
backend/
├── app.js                  # Express app configuration
├── server.js               # Server entry point
├── api.http                # API testing file (REST Client)
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker services
├── .env                    # Environment variables
│
├── config/
│   ├── database.js         # MongoDB connection
│   ├── cache.js            # Redis connection
│   └── jwt.js              # JWT configuration
│
├── controllers/
│   ├── authController.js   # Authentication logic
│   └── userController.js   # User management logic
│
├── middleware/
│   ├── auth.js             # JWT verification
│   ├── roleCheck.js        # Role authorization
│   └── cache.js            # Response caching
│
├── models/
│   └── UserSchema.js       # Mongoose user schema
│
├── routes/
│   ├── index.js            # Route aggregator
│   ├── authRoutes.js       # Auth routes
│   └── userRoutes.js       # User routes
│
└── utils/
    ├── validation.js       # Input validation
    └── tokenGenerator.js   # JWT utilities
```

## Quick Start

### Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

**Services:**
| Service | URL |
|---------|-----|
| API | http://localhost:5000 |
| MongoDB | localhost:27018 |
| Redis | localhost:6380 |

### Local Development

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

**Requirements:** Node.js 18+, MongoDB 7+, Redis 7+

## Environment Variables

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
MONGO_URI=mongodb://admin:admin123@localhost:27017/ucp_takra?authSource=admin
REDIS_URL=redis://:redis123@localhost:6379
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signup` | Register new user | Public |
| POST | `/login` | Login & get token | Public |
| POST | `/logout` | Logout & invalidate token | Token |
| GET | `/me` | Get current user | Token |

### Users (`/api/users`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/me` | Get my profile | Token |
| PUT | `/update` | Update my profile | Token |
| GET | `/` | Get all users | Admin |
| GET | `/:id` | Get user by ID | Admin |
| PUT | `/:id/role` | Update user role | Admin |
| DELETE | `/:id` | Delete user | Admin |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api` | API welcome |

## API Testing

Use the `api.http` file with VS Code REST Client extension:

1. Install [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
2. Open `api.http`
3. Click "Send Request" above any request
4. After login, copy the token and update `@token` variable

### Example Requests

**Register:**
```http
POST http://localhost:5000/api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "Test User"
}
```

**Login:**
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Protected Request:**
```http
GET http://localhost:5000/api/users/me
Authorization: Bearer <your-jwt-token>
```

## Docker Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v

# Restart single service
docker-compose restart app
```

## Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]
}
```

## User Roles

| Role | Permissions |
|------|-------------|
| `user` | Access own profile, update own data |
| `moderator` | User permissions + moderate content |
| `admin` | Full access to all endpoints |

## License

ISC

