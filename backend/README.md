# Backend API - Authentication & Authorization with Docker

A production-ready Node.js/Express backend with JWT authentication, role-based access control, MongoDB integration, Redis caching, and complete Docker setup.

## Features

- **JWT Authentication** - Secure token-based authentication with 7-day expiration
- **MongoDB Integration** - Persistent data storage with Mongoose ODM
- **Redis Caching** - High-performance response caching with TTL support
- **Docker Support** - Complete containerization with Docker & Docker Compose
- **Password Hashing** - Bcryptjs for secure password storage (10 salt rounds)
- **Role-Based Access Control** - Multi-role system (user, moderator, admin)
- **Input Validation** - Comprehensive validation with clear error messages
- **Error Handling** - Consistent error response format
- **MVC Architecture** - Clean separation of concerns

## Project Structure

```
backend/
├── app.js                  # Express application configuration
├── server.js               # Server entry point
├── package.json            # Dependencies and scripts
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose services
├── .env                    # Environment variables
│
├── config/
│   ├── database.js         # MongoDB connection & operations
│   ├── cache.js            # Redis connection & operations
│   └── jwt.js              # JWT configuration
│
├── controllers/
│   ├── authController.js   # Authentication logic (signup, login, logout)
│   ├── userController.js   # User management logic (CRUD, roles)
│   └── mainController.js   # General controller
│
├── middleware/
│   ├── auth.js             # JWT verification middleware
│   ├── roleCheck.js        # Role-based authorization middleware
│   └── cache.js            # Response caching middleware
│
├── models/
│   ├── UserSchema.js       # Mongoose user schema with methods
│   ├── User.js             # Legacy user model
│   └── mainModel.js        # General model
│
├── routes/
│   ├── index.js            # Route aggregator
│   ├── authRoutes.js       # Authentication routes
│   └── userRoutes.js       # User management routes
│
└── utils/
    ├── validation.js       # Input validation utilities
    └── tokenGenerator.js   # JWT generation & verification
```

## Installation & Quick Start

### Option 1: Docker (Recommended)

**Prerequisites**: Docker and Docker Compose installed

```bash
# Start all services (MongoDB, Redis, Node.js API)
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f app
```

**Services**:
- API: http://localhost:5000
- MongoDB: localhost:27017
- Redis: localhost:6379

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed Docker documentation.

### Option 2: Local Machine

**Prerequisites**: Node.js 18+, MongoDB 7.0+, Redis 7.0+

1. **Install Dependencies**
```bash
npm install
```

2. **MongoDB Setup (Local)**
```bash
# Install MongoDB
# https://docs.mongodb.com/manual/installation/

# Start MongoDB service
mongod
```

3. **Redis Setup (Local)**
```bash
# Install Redis
# https://redis.io/topics/quickstart& operations
│   ├── cache.js             # Redis cache setup & operations
│   └── jwt.js               # JWT configuration
├── controllers/             # Business logic
│   ├── mainController.js
├── middleware/              # Express middleware
│   ├── auth.js              # JWT verification
│   ├── roleCheck.js         # Role-based authorization
│   └── cache.js             # Request caching middleware
├── models/                  # Data models
│   ├── User.js              # User class (utilities)
│   └── UserSchema.js        # Mongoose schema for MongoDB
├── routes/                  # API routes
│   ├── auth.js              # Authentication endpoints
│   └── users.js             # User management endpoints
├── utils/                   # Utility functions
│   ├── validation.js        # Input validation
│   └── tokenGenerator.js    # JWT token operations
├── app.js                   # Express app setup
├── server.js                # Server entry point
├── package.json             # Dependencies
├── .env                     # Environment variables
├── Dockerfile               # Docker build instructions
├── docker-compose.yml       # Docker services orchestration
├── .dockerignore             # Files excluded from Docker build
├── README.md                # This file
├── DOCKER_SETUP.md          # Docker documentation

Server runs at `http://localhost:5000`

## Project Structure

```
backend/
├── config/                  # Configuration files
│   ├── database.js          # MongoDB connection and DB class
│   ├── jwt.js               # JWT configuration
├── controllers/             # Business logic
│   └── mainController.js
├── middleware/              # Express middleware
│   ├── auth.js              # JWT verification
│   └── roleCheck.js         # Role-based authorization
├── models/                  # Data models
│   ├── User.js              # User class (utilities)
│   └── UserSchema.js        # Mongoose schema for MongoDB
├── routes/                  # API routes
│   ├── auth.js              # Authentication endpoints
│   └── users.js             # User management endpoints
├── utils/                   # Utility functions
│   ├── validation.js        # Input validation
│   └── tokenGenerator.js    # JWT token operations
├── app.js                   # Express app setup
├── server.js                # Server entry point
├── package.json             # Dependencies
├── .env                     # Environment variables
├── README.md                # This file
└── API_DOCS.md              # API documentation
```

## File Organization

### models/User.js
Contains the User class with static password utilities:
- `User.hashPassword(password)` - Hash password
- `User.comparePassword(plain, hashed)` - Compare passwords

### models/UserSchema.js
MongoDB Mongoose schema with:
- Email validation and uniqueness constraint
- Password hashing middleware (runs before save)
- Instance methods: `comparePassword()`, `toSafeObject()`, `updateLastLogin()`
- Static methods: `findByEmail()`, `verifyCredentials()`

### config/database.js
Database operations class with async methods:
- `createUser(userData)` - Create new user
- `findUserByEmail(email)` - Find user by email
- `findUserById(id)` - Find user by ObjectId
- `getAllUsers()` - Get all users
- `updateUser(id, updates)` - Update user fields
- `deleteUser(id)` - Delete user

## API Endpoints

### Authentication

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### User Management (Protected)

All user endpoints require authentication. Add token to request header:
```
Authorization: Bearer <your-jwt-token>
```

#### Get Current User
```
GET /api/users/me
Authorization: Bearer <token>
```

#### Get All Users (Admin only)
```
GET /api/users
Authorization: Bearer <admin-token>
```

#### Get User by ID (Admin only)
```
GET /api/users/:id
Authorization: Bearer <admin-token>
```

#### Update User Role (Admin only)
```
PUT /api/users/:id/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "role": "moderator"
}
```

#### Delete User (Admin only)
```
DELETE /api/users/:id
Authorization: Bearer <admin-token>
```

## User Roles

| Role | Permissions |
|------|-------------|
| **user** | View own profile |
| **moderator** | View own profile, manage content |
| **admin** | Full access - manage all users, assign roles, delete users |

## Validation Rules

### Email
- Required
- Valid email format
- Maximum 100 characters
- Must be unique in database

### Password
- Required
- Minimum 6 characters
- Maximum 100 characters
- Hashed with bcryptjs (10 salt rounds)
- Never stored or returned in plain text

### Name
- Required
- Minimum 2 characters
- Maximum 50 characters
- Trimmed automatically

### Role
- Optional (defaults to 'user')
- Valid values: `user`, `moderator`, `admin`

## Error Handling

All endpoints follow consistent error format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Resource created
- `400` - Bad request / Validation failed
- `401` - Unauthorized / Invalid credentials
- `403` - Forbidden / Insufficient permissions
- `404` - Resource not found
- `409` - Conflict / Email already exists
- `500` - Server error

## Security Features

1. **Password Hashing**
   - Uses bcryptjs with 10 salt rounds
   - Hashed before storing in database
   - Never stored or returned in API responses

2. **JWT Tokens**
   - Signed with secret key
   - Expiration time: 7 days
   - Verified on every protected request
   - Contains: user id, email, role

3. **Input Validation**
   - Server-side validation on all inputs
   - Clear error messages for invalid data
   - Email uniqueness constraint in database

4. **Authorization**
   - Role-based access control
   - Token verification middleware
   - Protected endpoints

5. **MongoDB Security**
   -Start Services (Docker)

```bash
docker-compose up -d
```

### Register Admin User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "name": "Admin User",
    "role": "admin"
  }'
```

### Register Regular User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "user"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

**Response includes JWT token** - copy the token for next requests

### Get Current User (with JWT token)
```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get All Users (Admin only)
```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

### Check Cache (Redis)
```bash
# Inside Redis container
docker-compose exec redis redis-cli -a redis123

# View cache keys
> KEYS cache:*

# Check specific cache value
> GET cache:507f1f77bcf86cd799439011:/api/users/me
```

### Get All Users (Admin)
```bash
cur

## Troubleshooting

### Docker Issues

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for comprehensive Docker troubleshooting.

### MongoDB Connection
```bash
# Check connection inside Docker
docker-compose exec app npm list mongoose

# Test MongoDB
docker-compose exec mongodb mongosh -u admin -p admin123
```

### Redis Connection
```bash
# Check Redis health
docker-compose exec redis redis-cli -a redis123 PING

# Should return: PONG
```

### Clear All Data
```bash
# Remove all containers and volumes
docker-compose down -v

# Restart
docker-compose up -dginl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,                    // MongoDB ID
  email: String (unique),           // User email
  password: String (hashed),        // Bcryptjs hash
  name: String,                     // User name
  rPerformance Metrics

### Caching Performance

With Redis caching enabled:
- **First request**: ~20-50ms (DB query)
- **Cached request**: ~2-5ms (Redis hit)
- **Cache miss**: Auto-refreshed from DB

### MongoDB Performance

- Indexed queries on email field
- Automatic query optimization
- Connection pooling with Mongoose

### Docker Resource Usage

- MongoDB: ~300MB memory
- Redis: ~50MB memory
- Node.js API: ~100MB memory
- Total: ~450MB typical usage

## Next Steps

1. **Email Verification** - Verify user emails before account activation
2. **Refresh Tokens** - Add token refresh mechanism
3. **Rate Limiting** - Add rate limiting middleware
4. **Structured Logging** - Implement Winston or Pino
5. **Unit Tests** - Add Jest test suite
6. **API Documentation** - Add Swagger/OpenAPI
7. **Session Management** - Add session store to Redis
8. **Monitoring** - Add Prometheus metricsnected successfully"

# Inspect collections using MongoDB CLI
mongosh
> use ucp_takra
> db.users.find()
```

## Next Steps

1. **Email Verification** - Verify user emails before account activation
2. **Refresh Tokens** - Add token refresh mechanism for better security
3. **Rate Limiting** - Prevent abuse with rate limiting middleware
4. **Logging** - Implement structured logging (Winston, Pino, etc.)
5. **Tests** - Write unit and integration tests (Jest, Mocha, etc.)
6. **API Documentation** - Add Swagger/OpenAPI documentation

## Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB service is running: `mongod`
- Check `MONGO_URI` in `.env`
- Verify MongoDB is installed correctly

### Password Hashing Slow
- This is normal - bcryptjs uses 10 salt rounds for security
- Provides strong protection against brute force attacks

### Token Validation Errors
- Ensure token is included in Authorization header
- Use format: `Bearer <token>`
- Check JWT_SECRET in `.env`

## License

ISC

