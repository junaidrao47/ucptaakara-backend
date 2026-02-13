# Docker Setup Guide

Complete Docker setup for backend with MongoDB and Redis services.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (usually comes with Docker Desktop)

## Quick Start

### 1. Start All Services

```bash
# From the backend directory
docker-compose up -d
```

This command:
- Builds the Node.js application image
- Starts MongoDB container with authentication
- Starts Redis container
- Starts the Node.js application
- Sets up health checks for all services
- Creates persistent volumes for data

### 2. Verify Services Are Running

```bash
# Check running containers
docker-compose ps

# Expected output:
# NAME                COMMAND                  SERVICE     STATUS      PORTS
# ucp_backend         node server.js           app         running     0.0.0.0:5000->5000/tcp
# ucp_mongodb         mongod --auth            mongodb     running     0.0.0.0:27017->27017/tcp
# ucp_redis           redis-server             redis       running     0.0.0.0:6379->6379/tcp
```

### 3. Access Services

**API Server**: http://localhost:5000
**MongoDB**: localhost:27017
**Redis**: localhost:6379

## Service Details

### MongoDB

- **Image**: mongo:7.0 (Alpine-based)
- **Port**: 27017
- **Database**: ucp_takra
- **Username**: admin (configurable)
- **Password**: admin123 (configurable)
- **Persistence**: `mongodb_data` volume
- **Health Check**: Every 10 seconds

**Connection String (from outside Docker)**:
```
mongodb://admin:admin123@localhost:27017/ucp_takra?authSource=admin
```

**Connection String (from inside container)**:
```
mongodb://admin:admin123@mongodb:27017/ucp_takra?authSource=admin
```

### Redis

- **Image**: redis:7-alpine
- **Port**: 6379
- **Password**: redis123 (configurable)
- **Persistence**: `redis_data` volume (AOF enabled)
- **Health Check**: Every 10 seconds

**Connection String (from outside Docker)**:
```
redis://:redis123@localhost:6379
```

**Connection String (from inside container)**:
```
redis://:redis123@redis:6379
```

### Node.js Application

- **Image**: Built from Dockerfile
- **Port**: 5000
- **Node Version**: 18-Alpine (minimal footprint)
- **User**: nodejs (non-root for security)
- **Health Check**: Every 30 seconds
- **Health Endpoint**: http://localhost:5000/api/health

## Environment Variables

Edit `.env` file to customize:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=admin123
REDIS_PASSWORD=redis123
```

**Important**: The `docker-compose.yml` uses these variables to configure services. Changes require restart:
```bash
docker-compose restart
```

## Common Docker Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f mongodb
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 app
```

### Stop Services

```bash
# Stop all services (keep data)
docker-compose stop

# Stop and remove containers (keep volumes/data)
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Rebuild and restart
docker-compose up --build -d
```

### Execute Commands in Container

```bash
# Access MongoDB
docker-compose exec mongodb mongosh -u admin -p admin123

# Access Redis
docker-compose exec redis redis-cli -a redis123

# Run command in app container
docker-compose exec app npm list
```

## Database Management

### MongoDB

**Inside MongoDB Container**:
```bash
docker-compose exec mongodb mongosh -u admin -p admin123

# After connecting:
> use ucp_takra
> db.users.find()
> db.createCollection('users')
```

**MongoDB GUI Client** (optional):
- Use MongoDB Compass at: `mongodb://admin:admin123@localhost:27017`

### Redis

**Inside Redis Container**:
```bash
docker-compose exec redis redis-cli -a redis123

# Inside Redis CLI:
> PING
> KEYS *
> FLUSHDB
```

**Redis GUI Client** (optional):
- Use RedisInsight or similar tools

## Troubleshooting

### Services Won't Start

1. Check if ports are already in use:
```bash
# Windows
netstat -ano | findstr :5000

# Mac/Linux
lsof -i :5000
```

2. Check Docker daemon is running
3. Review logs:
```bash
docker-compose logs app
docker-compose logs mongodb
docker-compose logs redis
```

### MongoDB Connection Fails

```bash
# Check if health check passes
docker-compose ps mongodb

# If unhealthy, check logs
docker-compose logs mongodb

# Restart MongoDB
docker-compose restart mongodb
```

### Redis Connection Fails

```bash
# Test Redis connection
docker-compose exec redis redis-cli -a redis123 PING

# Should output: PONG
```

### Data Persistence Issues

```bash
# Check volumes
docker volume ls

# Inspect volume
docker volume inspect backend_mongodb_data

# Remove volume (WARNING: deletes data)
docker volume rm backend_mongodb_data
```

## Performance Optimization

### Memory Limits

Edit `docker-compose.yml` to add memory limits:

```yaml
services:
  mongodb:
    deploy:
      resources:
        limits:
          memory: 512M
  
  redis:
    deploy:
      resources:
        limits:
          memory: 256M
  
  app:
    deploy:
      resources:
        limits:
          memory: 512M
```

### CPU Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
```

## Production Considerations

1. **Change Passwords**: Update MONGO_ROOT_PASSWORD and REDIS_PASSWORD
2. **Change JWT_SECRET**: Use a strong random key
3. **Use Environment Files**: Store sensitive values in `.env.production`
4. **Enable SSL/TLS**: Add reverse proxy (Nginx, Traefik)
5. **Add Backups**: Set up MongoDB backup strategy
6. **Monitoring**: Add health checks and monitoring tools
7. **Logging**: Implement structured logging (ELK stack, etc.)

## Docker File Explanations

### Dockerfile

The Dockerfile uses multi-stage build for optimization:

1. **Builder Stage**: Installs all dependencies
2. **Production Stage**: 
   - Uses slim image
   - Installs dumb-init for proper signal handling
   - Creates non-root user (security feature)
   - Copies only necessary files
   - Sets health check
   - Exposes port 5000

### docker-compose.yml

Defines three services connected via `ucp_network`:

1. **MongoDB**: Database with persistent storage
2. **Redis**: Cache with persistent storage
3. **app**: Node.js API server

All services have:
- Explicit health checks
- Service dependency declarations
- Named volumes for data persistence
- Environmental configuration

## Networking

Services communicate via service names:

```
app → mongodb://admin:password@mongodb:27017
app → redis://:password@redis:6379
```

The internal network is isolated but ports are exposed to host machine.

## Useful Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Official Image](https://hub.docker.com/_/mongo)
- [Redis Official Image](https://hub.docker.com/_/redis)
- [Node.js Official Image](https://hub.docker.com/_/node)

## Next Steps

1. Test all services:
   ```bash
   curl http://localhost:5000/api/health
   ```

2. Create test user:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "test123",
       "name": "Test User"
     }'
   ```

3. Monitor logs in real-time:
   ```bash
   docker-compose logs -f
   ```
