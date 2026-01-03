# Swipe Backend Integration Guide

Complete API documentation for frontend integration with the Swipe Store Backend.

## Connection Details

| Setting | Value |
|---------|-------|
| **Base URL** | `http://localhost:3000/api` |
| **Health Check** | `GET /health` |
| **Content-Type** | `application/json` |

---

## Security Features

### Rate Limiting

The API implements rate limiting to protect against abuse:

**Auth Endpoints** (`/api/auth/*`):
- Limit: **10 requests per 10 minutes** per IP address
- Applies to: OTP requests, login, verification
- Headers: `RateLimit-*` standard headers included

**General API** (`/api/*`):
- Limit: **100 requests per 15 minutes** per IP address
- Applies to: All authenticated endpoints
- AdminJS routes are excluded from rate limiting

**Rate Limit Response (429):**
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "requestId": "uuid"
}
```

The response includes a `Retry-After` header indicating seconds until the limit resets.

### Input Sanitization

All user-submitted text fields are automatically sanitized to prevent stored XSS attacks:

**Sanitized Fields:**
- Customer/Vendor: `name`, `address`
- Product: `name`, `description`, `vendorRef`, `hallmarkCert`
- Invoice: Customer snapshot `name`, item `description`
- Payment: `notes`
- Category: `name`

**Not Sanitized** (validated by type):
- IDs, UUIDs, numbers, dates, phone, email, GSTIN, enums, SKUs, barcodes

HTML tags are stripped from sanitized fields before storage. This happens transparently; no changes are required to request/response formats.

### Database Resilience

The SQLite database is configured with:
- **WAL mode** for concurrent read/write performance
- **5-second busy timeout** to automatically handle database lock contention
- Automatic retries when multiple users write simultaneously



---

## Multi-User Architecture

### Shop (Tenant) Model
- All business data belongs to a **Shop**
- Users authenticate and operate within exactly one shop
- Data is completely isolated between shops

### Shop Bootstrap (Initial Setup)

Before any user can login, a shop must be created via the setup API:

#### GET `/api/setup/status`
Check if shop exists.
```json
// Response
{ "setupComplete": false, "shop": null }
```

#### POST `/api/setup/bootstrap`
Create shop and admin user (one-time setup).
```json
// Request
{
  "shopName": "My Shop",
  "adminPhone": "9876543210",
  "setupSecret": "your-setup-secret"
}

// Response
{
  "success": true,
  "shop": { "id": "shop-uuid", "name": "My Shop" },
  "user": { "id": "user-uuid", "phone": "9876543210", "role": "ADMIN" }
}
```

> **Note:** `setupSecret` must match the `SETUP_SECRET` environment variable.

### Post-Setup Login Behavior
- **Registered users** → Normal OTP login
- **Unregistered users** → `403: User not registered. Contact your shop admin.`
- **Shops are never auto-created** during login

---

## Authentication

Phone-based OTP authentication with JWT tokens.

### POST `/api/auth/request-otp`
Request OTP for a phone number.
```json
// Request
{ "phone": "9876543210" }

// Response
{ "success": true, "message": "OTP sent successfully", "phone": "9876543210" }
```

### POST `/api/auth/verify-otp` or `/api/auth/login`
Verify OTP and get JWT token. **Dev OTP: `111111`**
```json
// Request
{ "phone": "9876543210", "otp": "111111" }

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { 
    "id": "uuid", 
    "phone": "9876543210", 
    "name": "John",
    "role": "ADMIN",
    "shopId": "shop-uuid"
  }
}
```

### GET `/api/auth/me` *(Auth Required)*
Get current user info with shop details.
```json
// Response
{
  "id": "user-uuid",
  "phone": "9876543210",
  "name": "John",
  "role": "ADMIN",
  "shop": {
    "id": "shop-uuid",
    "name": "My Shop"
  }
}
```

### JWT Token Structure
```json
{
  "userId": "user-uuid",
  "shopId": "shop-uuid",
  "role": "ADMIN"
}
```

---

## User Management (ADMIN Only)

### GET `/api/auth/users`
List all users in your shop.
```json
// Response
[
  { "id": "uuid", "phone": "9876543210", "name": "John", "role": "ADMIN", "created_at": "..." }
]
```

### POST `/api/auth/users`
Create a new user in your shop.
```json
// Request
{ "phone": "1111111111", "name": "Sales Person", "role": "SALES" }

// Response
{ "id": "uuid", "phone": "1111111111", "name": "Sales Person", "role": "SALES", "shop": {...} }
```

> **Note:** Role defaults to `SALES` if not specified.

---

## Role Permissions

| Action | ADMIN | SALES |
|--------|-------|-------|
| Create (customers, products, etc.) | ✅ | ✅ |
| Read all data | ✅ | ✅ |
| Update records | ✅ | ✅ |
| Delete records | ✅ | ❌ |
| Change settings | ✅ | ❌ |
| Manage users | ✅ | ❌ |

---

## LAN Multi-User Setup

Run one backend on the local network:
```bash
npm start
# Server shows LAN URL: http://192.168.x.x:3000
```

Multiple devices can connect:
1. All devices point to the same backend URL
2. Each user logs in with their phone number
3. First login creates the shop; subsequent logins join as users (via admin invite)
4. All data syncs in real-time across devices

---

## Key Concepts

### Aggregate Objects
For entities like **Invoices**, you send/receive the complete object. The backend atomically handles the underlying tables.

### Idempotency Keys
Use `X-Request-Id: <UUID>` header on `POST /api/invoices` to prevent duplicate records on network retries.

### Server-Side Authority
The backend **always** recomputes totals, taxes, and balances. Client-sent calculations are ignored.

---

## Invoices

### GET `/api/invoices`
List all invoice headers.

### GET `/api/invoices/:id`
Get full invoice aggregate with items, totals, customer snapshot, and photos.

### POST `/api/invoices`
Create invoice. Supports `X-Request-Id` header for idempotency.
```json
{
  "customerId": "uuid (optional)",
  "type": "INVOICE",  // INVOICE | PROFORMA | LENDING
  "status": "UNPAID", // PAID | PARTIAL | UNPAID | PENDING
  "date": "2025-12-27",
  "dueDate": "2026-01-27",
  "placeOfSupply": "Karnataka",
  "customer": {
    "name": "John Doe",
    "phone": "+91...",
    "gstin": "...",
    "address": { "line1": "...", "pincode": "..." }
  },
  "items": [{
    "productId": "uuid (optional)",
    "description": "Gold Ring 22k",
    "quantity": 1,
    "rate": 65000,
    "taxRate": 3,
    "weight": { "gross": 5.2, "net": 4.8 },
    "amount": { "makingCharges": 500, "stoneCharges": 200 }
  }]
}
```
**Response includes server-computed `totals`:** subtotal, taxTotal, cgst, sgst, igst, roundOff, grandTotal.

### PUT `/api/invoices/:id`
Full replacement update.

### DELETE `/api/invoices/:id`
Soft delete.

### POST `/api/invoices/:id/photos`
Upload photo (multipart/form-data, field: `photo`).

**Limits:**
- Max file size: **5MB**
- Allowed types: `image/*` only

**Error Responses:**
```json
// 400: File too large
{ "error": "File too large. Maximum size is 5MB" }

// 400: Invalid type
{ "error": "Only image files are allowed" }
```

### DELETE `/api/invoices/:invoiceId/photos/:photoId`

---

## Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all |
| GET | `/api/customers/:id` | Get one (includes `balance`) |
| POST | `/api/customers` | Create |
| PUT | `/api/customers/:id` | Update |
| DELETE | `/api/customers/:id` | Soft delete |

### Request (POST/PUT)
```json
{
  "name": "Jane Smith",
  "gstin": "...",
  "phone": "9999999999",
  "email": "jane@example.com",
  "address": { "line1": "...", "city": "...", "pincode": "..." }
}
```

### Response (all endpoints)
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Jane Smith",
  "phone": "9999999999",
  "email": "jane@example.com",
  "gstin": "...",
  "balance": 0,
  "address": { "line1": "...", "city": "...", "pincode": "..." },
  "created_at": "2025-12-28T10:00:00.000Z",
  "updated_at": "2025-12-28T10:00:00.000Z"
}
```

> ⚠️ **IMPORTANT:** The `id` field is a **UUID generated by the backend**. Frontend must store and use this UUID for all subsequent operations (payments, invoices, etc.). Do NOT use local/IndexedDB IDs.

---

## Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List with images (filters: `?type=product`, `?categoryId=uuid`) |
| GET | `/api/products/:id` | Get with images |
| POST | `/api/products` | Create |
| PUT | `/api/products/:id` | Update (does NOT affect images) |
| DELETE | `/api/products/:id` | Soft delete |
| POST | `/api/products/:id/images` | Upload image (multipart) |
| DELETE | `/api/products/:productId/images/:imageId` | Delete image |

### Product JSON Schema
```json
{
  "type": "product",
  "name": "Diamond Earring",
  "sku": "DE-001",
  "sellingPrice": 120000,
  "taxRate": 3,
  "metal": { "purity": "18k", "type": "Rose Gold" },
  "gemstone": { "type": "Diamond", "carat": 0.5 }
}
```

### ⚠️ Image Handling (Important)

**Images are managed separately from product data.** The `PUT /api/products/:id` endpoint does **NOT** accept or modify images. Existing images persist across product updates.

#### Workflow
1. **Create/Update product** → `POST` or `PUT /api/products/:id` (no images in body)
2. **Add image** → `POST /api/products/:id/images` (multipart/form-data)
3. **Remove image** → `DELETE /api/products/:productId/images/:imageId`

#### Upload Request
```http
POST /api/products/:id/images
Content-Type: multipart/form-data

image: <binary file>   ← field name must be "image"
```

**Limits:**
- Max file size: **5MB**
- Allowed types: `image/*` only

**Error Responses:**
```json
// 400: File too large
{ "error": "File too large. Maximum size is 5MB" }

// 400: Invalid type
{ "error": "Only image files are allowed" }
```

#### Response from GET `/api/products/:id`
```json
{
  "id": "uuid",
  "name": "Diamond Earring",
  ...
  "images": [
    { "id": "image-uuid", "url": "/api/photos/image-uuid", "createdAt": "..." }
  ]
}
```

Images are linked via `product_id` foreign key and returned automatically when fetching a product.

---

## Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List (filters: `?partyId=uuid`, `?type=IN|OUT`) |
| GET | `/api/payments/:id` | Get with allocations |
| POST | `/api/payments` | Create (auto-updates invoice status & balance) |
| DELETE | `/api/payments/:id` | Delete (recalculates balances) |

```json
{
  "type": "IN",
  "partyType": "CUSTOMER",
  "partyId": "uuid",
  "amount": 10000,
  "date": "2025-12-27",
  "mode": "UPI",
  "allocations": [
    { "invoiceId": "uuid", "amount": 10000 }
  ]
}
```

---

## Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all with subcategories |
| GET | `/api/categories/:id` | Get one |
| POST | `/api/categories` | Create: `{ "name": "Gold Jewelry", "type": "product" }` |
| PUT | `/api/categories/:id` | Update |
| DELETE | `/api/categories/:id` | Delete (cascades subcategories) |
| POST | `/api/categories/:id/subcategories` | Add: `{ "name": "Rings" }` |
| DELETE | `/api/categories/:categoryId/subcategories/:subcategoryId` | Delete |

---

## Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List all |
| GET | `/api/vendors/:id` | Get one (includes `balance`) |
| POST | `/api/vendors` | Create |
| PUT | `/api/vendors/:id` | Update |
| DELETE | `/api/vendors/:id` | Soft delete |

Same request/response schema as Customers.

> ⚠️ **IMPORTANT:** The `id` field is a **UUID generated by the backend**. Use this UUID for payments and purchases.

---

## Purchases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchases` | List (filters: `?vendorId=uuid`, `?status=PAID|UNPAID`) |
| GET | `/api/purchases/:id` | Get with vendor info |
| POST | `/api/purchases` | Create |
| PUT | `/api/purchases/:id` | Update |
| DELETE | `/api/purchases/:id` | Soft delete |

```json
{
  "vendorId": "uuid",
  "date": "2025-12-27",
  "dueDate": "2026-01-27",
  "status": "UNPAID"
}
```

---

## Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/login` | Log login: `{ "userId": "uuid" }` |
| POST | `/api/attendance/logout` | Log logout: `{ "logId": "uuid" }` |
| GET | `/api/attendance/user/:userId` | History (`?limit=30`) |
| GET | `/api/attendance/user/:userId/date/:date` | Specific date |
| GET | `/api/attendance/date/:date` | All users (admin) |

---

## Photos

### GET `/api/photos/:id`
Serve image file directly. Use photo ID from invoice/product responses.

---

## Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all |
| GET | `/api/settings/:key` | Get one |
| PUT | `/api/settings/:key` | Set: `{ "value": ... }` |

---

## Home Snapshot

The home snapshot endpoint provides aggregated metrics for the home screen. All business logic is backend-owned.

### GET `/api/home/snapshot` *(Auth Required)*

Returns complete home screen data as a single deterministic snapshot.

**Response:**
```json
{
  "snapshotVersion": 1,
  "businessPulse": {
    "amountReceivedThisWeek": 50000,
    "percentChangeWoW": 25.5,
    "paymentsCompleted": 3
  },
  "primaryAction": {
    "mostUsed": "INVOICE"
  },
  "recentActivity": [
    {
      "type": "INVOICE",
      "title": "Overdue: INV-001",
      "subtitle": "Customer Name",
      "amount": 10000,
      "status": "OVERDUE",
      "date": "2025-12-15",
      "entityId": "invoice-uuid"
    }
  ],
  "riskSummary": {
    "unpaidInvoicesCount": 5,
    "unpaidAmount": 125000
  },
  "momentum": {
    "invoiceStreakDays": 7,
    "totalSentThisWeek": 12
  },
  "generatedAt": "2026-01-03T13:52:00.000Z"
}
```

**Field Descriptions:**

- `snapshotVersion`: Schema version (currently 1)
- `businessPulse`: Weekly payment metrics with WoW comparison
- `primaryAction.mostUsed`: `"INVOICE"` | `"PURCHASE"` | `"EXPENSE"` (based on last 30 days)
- `recentActivity`: Curated cards (max 3):
  - First: Oldest overdue invoice (if any)
  - Second: Last paid invoice (if any)
  - Third: Risk summary OR recent creation
- `riskSummary`: Aggregated unpaid/partial invoices
- `momentum.invoiceStreakDays`: Consecutive days with ≥1 invoice
- `generatedAt`: ISO timestamp of snapshot generation

**Caching:**

- Snapshots are cached server-side for 5 minutes
- Cache is automatically invalidated on invoice/payment/purchase mutations
- Subsequent calls within 5 minutes return cached data

**UI Guidelines:**

- Call once on home screen mount
- Render sections conditionally (check for empty arrays/zero counts)
- **NEVER** compute totals, percentages, or filters in UI
- All business logic is backend-owned


---

## Operations (Backup & Restore)

The operations endpoints provide manual backup functionality for local data safety.

### POST `/api/ops/backup` *(Auth Required)*

Create a full backup of the database and file storage as a single ZIP file.

**Security:**
- Requires authentication
- Prevents concurrent backups (409 Conflict if backup already running)
- Logs all backup creation to audit trail

**Request:**
```http
POST /api/ops/backup
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "filename": "swipe_backup_2026-01-03T14-30-00-000Z.zip",
  "sizeBytes": 1234567,
  "createdAt": "2026-01-03T14:30:00.000Z"
}
```

**Response (409 Conflict):**
```json
{
  "error": "Backup already in progress",
  "requestId": "uuid"
}
```

**Backup Contents:**
- SQLite database (`swipe.db`)
- All file storage (`storage/photos/`)
- Packaged as a single timestamped ZIP file

**Storage Location:** `storage/backups/`

---

### GET `/api/ops/backup/:filename` *(Auth Required)*

Download a previously created backup ZIP file.

**Security:**
- Requires authentication
- Strict filename validation (prevents path traversal attacks)
- Only allows filenames matching pattern: `swipe_backup_<timestamp>.zip`

**Request:**
```http
GET /api/ops/backup/swipe_backup_2026-01-03T14-30-00-000Z.zip
Authorization: Bearer <token>
```

**Response (200 OK):**
- Binary ZIP file download
- Content-Disposition header set for automatic download

**Response (400 Bad Request):**
```json
{
  "error": "Invalid backup filename",
  "requestId": "uuid"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Backup file not found",
  "requestId": "uuid"
}
```

**Frontend Integration Example:**
```javascript
// 1. Create backup
const createBackup = async () => {
  const response = await fetch('/api/ops/backup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status === 409) {
    alert('Backup already in progress');
    return;
  }
  
  const { filename } = await response.json();
  
  // 2. Download using fetch (Authorization header required)
  const downloadResponse = await fetch(`/api/ops/backup/${filename}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!downloadResponse.ok) {
    throw new Error('Download failed');
  }
  
  // 3. Trigger browser download from blob
  const blob = await downloadResponse.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
```

> ⚠️ **IMPORTANT:** Do NOT use `window.location.href` for the download. Browser navigation does not include the `Authorization` header, causing a 401 error. Always use `fetch()` with the token.

**Best Practices:**
1. Show loading state during backup creation (can take several seconds)
2. Handle 409 errors gracefully (inform user, disable button)
3. Automatically trigger download on successful backup creation
4. Consider debouncing backup button clicks


---

## Error Responses


```json
{
  "error": "Short description",
  "details": {},
  "requestId": "uuid"
}
```

| Code | Meaning |
|------|---------|
| 400 | Validation failed |
| 401 | Auth required |
| 403 | Forbidden / Invalid token |
| 404 | Not found |
| 500 | Server error |

---

## Best Practices

1. **Dates:** Use ISO 8601 format (`YYYY-MM-DD`)
2. **Auth:** Include `Authorization: Bearer <token>` header for protected routes
3. **Idempotency:** Use `X-Request-Id` header for invoice creation
4. **Balances:** Always read balances from server; never calculate client-side
