# UCP-TAKRA Backend API

A production-ready Competition Management Platform backend built with Node.js/Express, featuring JWT authentication, role-based access control, MongoDB, Redis caching, AWS S3 image uploads, and Docker support.

## Features

- **JWT Authentication** - Dual token system (access: 15min, refresh: 7 days)
- **Google OAuth** - Social authentication with Passport.js
- **Role-Based Access Control** - user, support, admin roles
- **MongoDB Integration** - Mongoose ODM with optimized queries
- **Redis Caching** - Response caching with TTL support
- **AWS S3 Integration** - Image uploads with optimization
- **Image Processing** - Sharp-based optimization (WebP, multiple sizes)
- **Docker Support** - Complete containerization setup
- **Input Validation** - express-validator with comprehensive checks
- **MVC Architecture** - Clean separation of concerns

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API_REFERENCE.md) | Complete API documentation |
| [Architecture](docs/ARCHITECTURE.md) | System architecture overview |
| [api.http](api.http) | Interactive API testing file |

## Project Structure

```
backend/
├── app.js                  # Express app configuration
├── server.js               # Server entry point
├── api.http                # API testing file (REST Client)
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker services
│
├── config/
│   ├── database.js         # MongoDB connection
│   ├── cache.js            # Redis connection
│   ├── jwt.js              # JWT configuration
│   ├── passport.js         # Google OAuth setup
│   └── s3.js               # AWS S3 configuration
│
├── controllers/
│   ├── authController.js       # Authentication
│   ├── userController.js       # User management
│   ├── dashboardController.js  # User dashboard
│   ├── categoryController.js   # Public categories
│   ├── competitionController.js# Public competitions
│   ├── registrationController.js# User registrations
│   ├── supportController.js    # Support staff features
│   ├── uploadController.js     # File uploads
│   └── admin/
│       ├── categoryController.js    # Admin categories
│       ├── competitionController.js # Admin competitions
│       ├── registrationController.js# Admin registrations
│       └── analyticsController.js   # Admin analytics
│
├── middleware/
│   ├── auth.js             # JWT verification
│   ├── roleCheck.js        # Role authorization
│   ├── cache.js            # Response caching
│   ├── upload.js           # Multer file upload
│   └── validators.js       # Input validation
│
├── models/
│   ├── UserSchema.js       # User model
│   ├── Category.js         # Category model
│   ├── Competition.js      # Competition model
│   └── Registration.js     # Registration model
│
├── routes/
│   ├── index.js            # Route aggregator
│   ├── authRoutes.js       # Auth routes
│   ├── userRoutes.js       # User routes
│   ├── dashboardRoutes.js  # Dashboard routes
│   ├── categoryRoutes.js   # Category routes
│   ├── competitionRoutes.js# Competition routes
│   ├── registrationRoutes.js# Registration routes
│   ├── supportRoutes.js    # Support routes
│   ├── uploadRoutes.js     # Upload routes
│   └── admin/              # Admin route modules
│
├── utils/
│   ├── validation.js       # Input validation
│   ├── tokenGenerator.js   # JWT utilities
│   └── imageOptimizer.js   # Sharp image processing
│
└── docs/
    ├── API_REFERENCE.md    # API documentation
    └── ARCHITECTURE.md     # Architecture docs
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
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |

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
# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Database
MONGO_URI=mongodb://admin:admin123@localhost:27017/ucp_takra?authSource=admin

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-bucket-name
AWS_S3_BASE_URL=https://your-bucket.s3.region.amazonaws.com
```

## API Overview

### Public Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/auth` | Login, register, OAuth |
| Categories | `/api/categories` | Browse categories |
| Competitions | `/api/competitions` | Browse competitions |
| Health | `/api/health` | Health check |

### Protected Endpoints (User)

| Module | Base Path | Description |
|--------|-----------|-------------|
| Users | `/api/users` | Profile management |
| Dashboard | `/api/dashboard` | User dashboard |
| Registrations | `/api/registrations` | Register for competitions |
| Uploads | `/api/uploads` | File uploads |

### Support Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Support | `/api/support` | Manage registrations |

### Admin Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Categories | `/api/admin/categories` | CRUD categories |
| Competitions | `/api/admin/competitions` | CRUD competitions |
| Registrations | `/api/admin/registrations` | Manage all registrations |
| Analytics | `/api/admin/analytics` | Dashboard & charts |

📖 **Full API documentation:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

## API Testing

Use the `api.http` file with VS Code REST Client extension:

1. Install [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
2. Open `api.http`
3. Click "Send Request" above any request
4. After login, copy tokens to variables at top of file

## User Roles

| Role | Permissions |
|------|-------------|
| `user` | Profile, dashboard, register for competitions |
| `support` | User + manage registrations (approve/reject) |
| `admin` | Full access to all endpoints |

## Image Processing

Images uploaded via `/api/uploads` are automatically:
- Converted to WebP format
- Resized to multiple sizes
- Optimized for web delivery
- Stored on AWS S3

| Type | Sizes Generated |
|------|-----------------|
| Category Icon | 200x200, 64x64 |
| Category Banner | 1200x400, 400x133 |
| Competition Cover | 1920x600, 800x250, 400x125 |
| Competition Gallery | 1200x1200, 600x600, 150x150 |

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
  "error": "Details (dev only)"
}
```

## License

ISC
