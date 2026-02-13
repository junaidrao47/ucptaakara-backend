/**
 * API Documentation
 * 
 * BASE URL: http://localhost:5000/api
 * 
 * AUTHENTICATION ENDPOINTS
 * ========================
 * 
 * 1. Register User
 *    POST /auth/register
 *    Body: {
 *      "email": "user@example.com",
 *      "password": "password123",
 *      "name": "John Doe",
 *      "role": "user" // optional, defaults to 'user'
 *    }
 *    Response: { success: true, token, user }
 * 
 * 2. Login
 *    POST /auth/login
 *    Body: {
 *      "email": "user@example.com",
 *      "password": "password123"
 *    }
 *    Response: { success: true, token, user }
 * 
 * 
 * USER ENDPOINTS (Authenticated)
 * ==============================
 * 
 * 3. Get Current User
 *    GET /users/me
 *    Headers: { Authorization: "Bearer <token>" }
 *    Response: { success: true, user }
 * 
 * 4. Get All Users (Admin only)
 *    GET /users
 *    Headers: { Authorization: "Bearer <token>" }
 *    Response: { success: true, users: [] }
 * 
 * 5. Get User by ID (Admin only)
 *    GET /users/:id
 *    Headers: { Authorization: "Bearer <token>" }
 *    Response: { success: true, user }
 * 
 * 6. Update User Role (Admin only)
 *    PUT /users/:id/role
 *    Headers: { Authorization: "Bearer <token>" }
 *    Body: { "role": "moderator" }
 *    Response: { success: true, user }
 * 
 * 7. Delete User (Admin only)
 *    DELETE /users/:id
 *    Headers: { Authorization: "Bearer <token>" }
 *    Response: { success: true }
 * 
 * 
 * AVAILABLE ROLES
 * ===============
 * - user (default)
 * - moderator
 * - admin
 * 
 * 
 * EXAMPLE USAGE
 * =============
 * 
 * 1. Register
 * curl -X POST http://localhost:5000/api/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "email": "john@example.com",
 *     "password": "password123",
 *     "name": "John Doe",
 *     "role": "user"
 *   }'
 * 
 * 2. Login
 * curl -X POST http://localhost:5000/api/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "email": "john@example.com",
 *     "password": "password123"
 *   }'
 * 
 * 3. Get Current User (use token from login)
 * curl -X GET http://localhost:5000/api/users/me \
 *   -H "Authorization: Bearer <your-jwt-token>"
 * 
 * 4. Get All Users (Admin only)
 * curl -X GET http://localhost:5000/api/users \
 *   -H "Authorization: Bearer <admin-jwt-token>"
 * 
 * 
 * ERROR HANDLING
 * ==============
 * All endpoints return consistent error responses:
 * {
 *   "success": false,
 *   "message": "Error description here"
 * }
 * 
 * Common HTTP Status Codes:
 * - 200: Success
 * - 201: Resource created
 * - 400: Bad request / Validation failed
 * - 401: Unauthorized
 * - 403: Forbidden (insufficient permissions)
 * - 404: Not found
 * - 409: Conflict (e.g., email already exists)
 * - 500: Server error
 * 
 * 
 * VALIDATION RULES
 * ================
 * 
 * Email:
 *   - Required, valid format
 *   - Max 100 characters
 *   - Must be unique
 * 
 * Password:
 *   - Required
 *   - Minimum 6 characters
 *   - Maximum 100 characters
 *   - Hashed using bcryptjs
 * 
 * Name:
 *   - Required
 *   - Minimum 2 characters
 *   - Maximum 50 characters
 * 
 * Role:
 *   - Optional (defaults to 'user')
 *   - Must be: user, moderator, or admin
 */

// This file serves as API documentation
