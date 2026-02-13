/**
 * Complete API Endpoints Documentation & Testing Guide
 * Backend URL: http://localhost:5000/api
 */

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * 1. SIGNUP / REGISTER USER
 * POST /auth/signup
 * POST /auth/register (alias)
 */

// Example Request:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "user" // optional: 'user', 'moderator', 'admin'
}

// Example cURL:
/*
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "john123456",
    "name": "John Doe",
    "role": "user"
  }'
*/

// ============================================
// 2. LOGIN USER
// POST /auth/login
// ============================================

// Example Request:
{
  "email": "user@example.com",
  "password": "password123"
}

// Example cURL:
/*
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "john123456"
  }'
*/

// Response includes: JWT token (use in next requests)

// ============================================
// 3. LOGOUT USER
// POST /auth/logout
// ============================================

// Headers:
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}

// Example cURL:
/*
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
*/

// ============================================
// USER ENDPOINTS (All require authentication)
// ============================================

/**
 * 4. GET CURRENT USER PROFILE
 * GET /users/me
 */

// Example cURL:
/*
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
*/

// ============================================
// 5. UPDATE USER PROFILE
// PUT /users/update
// ============================================

// Example Request (update name):
{
  "name": "Jane Doe"
}

// Example Request (update email):
{
  "email": "newemail@example.com"
}

// Example Request (update both):
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com"
}

// Example cURL:
/*
curl -X PUT http://localhost:5000/api/users/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
*/

// ============================================
// 6. GET USER BY ID
// GET /users/:id
// (Admin only)
// ============================================

// Example cURL:
/*
curl -X GET http://localhost:5000/api/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer ADMIN_TOKEN"
*/

// ============================================
// 7. GET ALL USERS
// GET /users
// GET /users/allusers (alias)
// (Admin only)
// ============================================

// Example cURL (List all users):
/*
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN"
*/

// Example cURL (Alternative endpoint):
/*
curl -X GET http://localhost:5000/api/users/allusers \
  -H "Authorization: Bearer ADMIN_TOKEN"
*/

// ============================================
// 8. GET USER PROFILE BY ID (Alternative)
// GET /users/userprofile/:id
// (Admin only)
// ============================================

// Example cURL:
/*
curl -X GET http://localhost:5000/api/users/userprofile/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer ADMIN_TOKEN"
*/

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * 9. UPDATE USER ROLE
 * PUT /users/:id/role
 * (Admin only)
 */

// Example Request:
{
  "role": "moderator" // 'user', 'moderator', 'admin'
}

// Example cURL:
/*
curl -X PUT http://localhost:5000/api/users/507f1f77bcf86cd799439011/role \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
*/

// ============================================
// 10. DELETE USER
// DELETE /users/:id
// (Admin only)
// ============================================

// Example cURL:
/*
curl -X DELETE http://localhost:5000/api/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer ADMIN_TOKEN"
*/

// ============================================
// RESPONSE FORMATS
// ============================================

// Success Response Example:
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

// Error Response Example:
{
  "success": false,
  "message": "Invalid email or password"
}

// ============================================
// COMPLETE WORKFLOW EXAMPLE
// ============================================

/*
1. SIGNUP
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "secure123",
    "name": "New User",
    "role": "user"
  }'

Response: { token: "jwt_token_here", user: {...} }

2. STORE TOKEN from response
3. USE TOKEN for next requests

4. GET PROFILE
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer jwt_token_here"

5. UPDATE PROFILE
curl -X PUT http://localhost:5000/api/users/update \
  -H "Authorization: Bearer jwt_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

6. LOGOUT
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer jwt_token_here"
*/

// ============================================
// HTTP STATUS CODES
// ============================================

/*
200 - OK / Success
201 - Created / Resource created
400 - Bad Request / Invalid input
401 - Unauthorized / Invalid credentials
403 - Forbidden / Insufficient permissions
404 - Not Found / Resource not found
409 - Conflict / Email already exists
500 - Server Error
*/

// ============================================
// VALIDATION RULES
// ============================================

/*
Email:
  - Required
  - Valid email format
  - Max 100 characters
  - Must be unique

Password:
  - Required
  - Minimum 6 characters
  - Maximum 100 characters
  - Will be hashed before storage

Name:
  - Required
  - Minimum 2 characters
  - Maximum 50 characters
  - Trimmed automatically

Role:
  - Optional (defaults to 'user')
  - Valid: 'user', 'moderator', 'admin'
*/

// ============================================
// AUTHENTICATION HEADERS
// ============================================

/*
Format: Bearer <JWT_TOKEN>

Example:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzM5NTU1NjAwLCJleHAiOjE3NDAyMzk2MDB9

Token expires after 7 days by default.
*/
