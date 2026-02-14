# UCP-TAKRA API Documentation

> Competition Management Platform - API Reference

**Base URL:** `http://localhost:5000/api`  
**Version:** 2.0.0

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Dashboard](#3-dashboard)
4. [Categories](#4-categories)
5. [Competitions](#5-competitions)
6. [Registrations](#6-registrations)
7. [Uploads](#7-uploads)
8. [Support](#8-support)
9. [Admin - Categories](#9-admin---categories)
10. [Admin - Competitions](#10-admin---competitions)
11. [Admin - Registrations](#11-admin---registrations)
12. [Admin - Analytics](#12-admin---analytics)

---

## Authentication Headers

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Types
| Token | Expiry | Usage |
|-------|--------|-------|
| Access Token | 15 minutes | API requests |
| Refresh Token | 7 days | Get new access tokens |

### User Roles
| Role | Access Level |
|------|--------------|
| `user` | Basic user features |
| `support` | User features + registration management |
| `admin` | Full access to all features |

---

## 1. Authentication

Base path: `/api/auth`

### Register User
```http
POST /api/auth/signup
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "role": "user"  // Optional: user, support, admin
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { "id", "email", "name", "role" },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

---

### Login
```http
POST /api/auth/login
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "name", "role" },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

---

### Refresh Token
```http
POST /api/auth/refresh
```
**Body:**
```json
{
  "refreshToken": "jwt..."
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt...",
    "refreshToken": "new_jwt..."
  }
}
```

---

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```
**Response:** `200 OK`

---

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```
**Response:** `200 OK`

---

### Revoke Refresh Token
```http
POST /api/auth/revoke
Authorization: Bearer <token>
```
**Response:** `200 OK`

---

### Google OAuth
```http
GET /api/auth/google
```
Redirects to Google OAuth. After success, redirects to:
```
http://localhost:3000/oauth/callback?accessToken=<jwt>&refreshToken=<jwt>
```

---

## 2. Users

Base path: `/api/users`

### Get My Profile
```http
GET /api/users/me
Authorization: Bearer <token>
```

---

### Update My Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Updated Name",
  "phone": "+1234567890",
  "bio": "About me..."
}
```

---

### Get All Users (Admin)
```http
GET /api/users
Authorization: Bearer <admin_token>
```

---

### Get User by ID (Admin)
```http
GET /api/users/:userId
Authorization: Bearer <admin_token>
```

---

### Update User Role (Admin)
```http
PUT /api/users/:userId/role
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "role": "support"
}
```

---

### Delete User (Admin)
```http
DELETE /api/users/:userId
Authorization: Bearer <admin_token>
```

---

## 3. Dashboard

Base path: `/api/dashboard`

### Get Dashboard Overview
```http
GET /api/dashboard
Authorization: Bearer <token>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "registrations": {
      "total": 5,
      "pending": 2,
      "approved": 3
    },
    "upcomingCompetitions": [...],
    "recentActivity": [...]
  }
}
```

---

### Get My Statistics
```http
GET /api/dashboard/stats
Authorization: Bearer <token>
```

---

### Get Activity Feed
```http
GET /api/dashboard/activity
Authorization: Bearer <token>
```

---

## 4. Categories

Base path: `/api/categories`

### Get All Categories (Public)
```http
GET /api/categories
GET /api/categories?includeStats=true
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Hackathon",
      "slug": "hackathon",
      "description": "...",
      "competitionsCount": 5,
      "images": {
        "icon": { "url", "thumbnail", "placeholder" },
        "banner": { "url", "thumbnail", "placeholder" }
      }
    }
  ]
}
```

---

### Get Category by Slug (Public)
```http
GET /api/categories/:slug
```

---

## 5. Competitions

Base path: `/api/competitions`

### Get All Competitions (Public)
```http
GET /api/competitions
```
**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | ObjectId | Filter by category |
| `status` | string | Filter: `published`, `draft`, `completed` |
| `search` | string | Full-text search |
| `sort` | string | `newest`, `popular`, `trending`, `deadline` |
| `startDate` | date | Filter competitions starting after |
| `endDate` | date | Filter competitions ending before |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |

---

### Get Featured Competitions
```http
GET /api/competitions/featured
```

---

### Get Trending Competitions
```http
GET /api/competitions/trending
```

---

### Get Upcoming Competitions
```http
GET /api/competitions/upcoming?limit=5
```

---

### Get Competition Calendar
```http
GET /api/competitions/calendar?year=2024&month=6
```

---

### Get Competition Suggestions (Autocomplete)
```http
GET /api/competitions/suggestions?q=hack
```

---

### Get Competition by ID/Slug
```http
GET /api/competitions/:identifier
```

---

### Get Related Competitions
```http
GET /api/competitions/:id/related
```

---

## 6. Registrations

Base path: `/api/registrations`

### Register for Competition
```http
POST /api/registrations/:competitionId
Authorization: Bearer <token>
```
**Body:**
```json
{
  "institution": "University Name",
  "phone": "+1234567890",
  "experience": "beginner|intermediate|advanced|expert",
  "expectations": "What I hope to gain...",
  "teamName": "Team Name",
  "teamMembers": [
    { "name": "Member 1", "email": "m1@example.com", "role": "Developer" }
  ],
  "referralSource": "social_media|friend|website|email|other"
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "confirmationCode": "ABC12345",
    "registration": { ... }
  }
}
```

---

### Get My Registrations
```http
GET /api/registrations/my
GET /api/registrations/my?status=approved
Authorization: Bearer <token>
```

---

### Check Registration Status
```http
GET /api/registrations/check/:competitionId
Authorization: Bearer <token>
```

---

### Get Registration by ID
```http
GET /api/registrations/:id
Authorization: Bearer <token>
```

---

### Get Registration by Confirmation Code
```http
GET /api/registrations/code/:code
Authorization: Bearer <token>
```

---

### Cancel Registration
```http
PATCH /api/registrations/:id/cancel
Authorization: Bearer <token>
```

---

### Submit Project
```http
POST /api/registrations/:id/submit
Authorization: Bearer <token>
```
**Body:**
```json
{
  "title": "Project Title",
  "description": "Project description...",
  "repositoryUrl": "https://github.com/...",
  "demoUrl": "https://demo.example.com",
  "videoUrl": "https://youtube.com/...",
  "techStack": ["Node.js", "React", "MongoDB"]
}
```

---

## 7. Uploads

Base path: `/api/uploads`

### Upload Category Images (Admin)
```http
POST /api/uploads/category/:categoryId
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```
**Form Fields:**
| Field | Type | Max Size | Description |
|-------|------|----------|-------------|
| `icon` | file | 10MB | Category icon (200x200) |
| `banner` | file | 10MB | Category banner (1200x400) |

**Response:**
```json
{
  "success": true,
  "data": {
    "images": {
      "icon": { "url", "thumbnail", "placeholder" },
      "banner": { "url", "thumbnail", "placeholder" }
    }
  }
}
```

---

### Upload Competition Images (Admin)
```http
POST /api/uploads/competition/:competitionId
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```
**Form Fields:**
| Field | Type | Max Size | Description |
|-------|------|----------|-------------|
| `cover` | file | 10MB | Cover image (1920x600) |
| `gallery` | files | 10MB each | Gallery images (up to 10) |

---

### Delete Gallery Image (Admin)
```http
DELETE /api/uploads/competition/:competitionId/gallery/:imageIndex
Authorization: Bearer <admin_token>
```

---

### Upload Generic Image
```http
POST /api/uploads/image
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Form Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `image` | file | Image file |
| `folder` | string | Destination folder (e.g., "misc") |

---

## 8. Support

Base path: `/api/support`  
**Required Role:** `support` or `admin`

### Get Dashboard Stats
```http
GET /api/support/dashboard
Authorization: Bearer <support_token>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "pendingRegistrations": 15,
    "todayRegistrations": 8,
    "activeCompetitions": 3
  }
}
```

---

### Get Pending Registrations
```http
GET /api/support/registrations/pending
GET /api/support/registrations/pending?search=john&competition=<id>&page=1&limit=20
Authorization: Bearer <support_token>
```

---

### Approve Registration
```http
PATCH /api/support/registrations/:id/approve
Authorization: Bearer <support_token>
```

---

### Reject Registration
```http
PATCH /api/support/registrations/:id/reject
Authorization: Bearer <support_token>
```
**Body:**
```json
{
  "reason": "Reason for rejection"
}
```

---

### Search Users
```http
GET /api/support/users/search?q=john
Authorization: Bearer <support_token>
```

---

### Get User Registrations
```http
GET /api/support/users/:userId/registrations
Authorization: Bearer <support_token>
```

---

## 9. Admin - Categories

Base path: `/api/admin/categories`  
**Required Role:** `admin`

### Create Category
```http
POST /api/admin/categories
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "name": "Hackathon",
  "slug": "hackathon",
  "description": "24-48 hour coding competitions",
  "icon": "code",
  "color": "#FF5733",
  "displayOrder": 1
}
```

---

### Get All Categories (includes inactive)
```http
GET /api/admin/categories
GET /api/admin/categories?includeInactive=true
Authorization: Bearer <admin_token>
```

---

### Get Category by ID
```http
GET /api/admin/categories/:id
Authorization: Bearer <admin_token>
```

---

### Update Category
```http
PUT /api/admin/categories/:id
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

---

### Reorder Categories
```http
PUT /api/admin/categories/reorder
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "categoryIds": ["id1", "id2", "id3"]
}
```

---

### Delete Category (Soft Delete)
```http
DELETE /api/admin/categories/:id
Authorization: Bearer <admin_token>
```

---

## 10. Admin - Competitions

Base path: `/api/admin/competitions`  
**Required Role:** `admin`

### Create Competition
```http
POST /api/admin/competitions
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "title": "Code Challenge 2024",
  "slug": "code-challenge-2024",
  "shortDescription": "Annual coding competition",
  "description": "Full description...",
  "category": "<category_id>",
  "startDate": "2024-06-01T09:00:00Z",
  "endDate": "2024-06-03T09:00:00Z",
  "deadline": "2024-05-25T23:59:59Z",
  "maxParticipants": 500,
  "registrationFee": 0,
  "prizes": [
    { "position": 1, "title": "1st Place", "amount": 5000, "currency": "PKR" }
  ],
  "timeline": [
    { "title": "Registration Opens", "date": "2024-05-01", "description": "..." }
  ],
  "rules": ["Rule 1", "Rule 2"],
  "requirements": ["Requirement 1"],
  "tags": ["coding", "hackathon"],
  "contactEmail": "contact@example.com",
  "venue": "Online"
}
```

---

### Get All Competitions
```http
GET /api/admin/competitions
GET /api/admin/competitions?status=draft&page=1&limit=10
Authorization: Bearer <admin_token>
```

---

### Get Competition by ID
```http
GET /api/admin/competitions/:id
Authorization: Bearer <admin_token>
```

---

### Update Competition
```http
PUT /api/admin/competitions/:id
Authorization: Bearer <admin_token>
```

---

### Publish Competition
```http
PATCH /api/admin/competitions/:id/publish
Authorization: Bearer <admin_token>
```

---

### Toggle Featured Status
```http
PATCH /api/admin/competitions/:id/feature
Authorization: Bearer <admin_token>
```

---

### Duplicate Competition
```http
POST /api/admin/competitions/:id/duplicate
Authorization: Bearer <admin_token>
```

---

### Get Competition Registrations
```http
GET /api/admin/competitions/:id/registrations?status=approved&page=1&limit=20
Authorization: Bearer <admin_token>
```

---

### Delete Competition (Soft Delete)
```http
DELETE /api/admin/competitions/:id
Authorization: Bearer <admin_token>
```

---

## 11. Admin - Registrations

Base path: `/api/admin/registrations`  
**Required Role:** `admin`

### Get All Registrations
```http
GET /api/admin/registrations
GET /api/admin/registrations?status=pending&competition=<id>&page=1&limit=20
Authorization: Bearer <admin_token>
```

---

### Get Registration by ID
```http
GET /api/admin/registrations/:id
Authorization: Bearer <admin_token>
```

---

### Approve Registration
```http
PATCH /api/admin/registrations/:id/approve
Authorization: Bearer <admin_token>
```

---

### Reject Registration
```http
PATCH /api/admin/registrations/:id/reject
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "reason": "Rejection reason"
}
```

---

### Bulk Approve
```http
POST /api/admin/registrations/bulk-approve
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "registrationIds": ["id1", "id2", "id3"]
}
```

---

### Bulk Reject
```http
POST /api/admin/registrations/bulk-reject
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "registrationIds": ["id1", "id2"],
  "reason": "Bulk rejection reason"
}
```

---

### Update Registration
```http
PATCH /api/admin/registrations/:id
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "notes": "Admin notes..."
}
```

---

### Export Registrations
```http
GET /api/admin/registrations/export?competition=<id>&status=approved
Authorization: Bearer <admin_token>
```

---

## 12. Admin - Analytics

Base path: `/api/admin/analytics`  
**Required Role:** `admin`

### Get Dashboard Overview
```http
GET /api/admin/analytics/dashboard
Authorization: Bearer <admin_token>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalCompetitions": 12,
    "totalRegistrations": 450,
    "activeCompetitions": 5,
    "pendingRegistrations": 23,
    "recentUsers": [...],
    "topCompetitions": [...]
  }
}
```

---

### Get Realtime Stats
```http
GET /api/admin/analytics/realtime
Authorization: Bearer <admin_token>
```

---

### Get User Growth (Chart Data)
```http
GET /api/admin/analytics/users/growth?period=30
Authorization: Bearer <admin_token>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["2024-01-01", "2024-01-02", ...],
    "values": [5, 8, 12, ...]
  }
}
```

---

### Get Registration Trends (Chart Data)
```http
GET /api/admin/analytics/registrations/trends?period=30
Authorization: Bearer <admin_token>
```

---

### Get Category Performance
```http
GET /api/admin/analytics/categories/performance
Authorization: Bearer <admin_token>
```

---

### Get Competition Analytics
```http
GET /api/admin/analytics/competitions?period=30
Authorization: Bearer <admin_token>
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Invalid/missing token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found |
| `409` | Conflict - Duplicate resource |
| `422` | Validation Error |
| `500` | Internal Server Error |

---

## Rate Limiting

API requests are limited to prevent abuse:
- **General endpoints:** 100 requests/minute
- **Auth endpoints:** 10 requests/minute

---

## Image Processing

Uploaded images are automatically:
- Converted to WebP format
- Resized to multiple sizes (original, medium, thumbnail)
- Optimized for web delivery
- Stored on AWS S3

**Image Sizes:**
| Type | Original | Medium | Thumbnail |
|------|----------|--------|-----------|
| Category Icon | 200x200 | - | 64x64 |
| Category Banner | 1200x400 | - | 400x133 |
| Competition Cover | 1920x600 | 800x250 | 400x125 |
| Competition Gallery | 1200x1200 | 600x600 | 150x150 |

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page (max: 100) |

**Response includes:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5,
    "hasMore": true
  }
}
```

---

## Contact

For API support, contact: **api-support@ucp-takra.com**
