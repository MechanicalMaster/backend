# Swipe Backend Integration Guide

Complete API documentation for frontend integration with the Swipe Store Backend.

## Connection Details

| Setting | Value |
|---------|-------|
| **Base URL** | `http://localhost:3000/api` |
| **Health Check** | `GET /health` |
| **Content-Type** | `application/json` |

---

## Authentication

Phone-based OTP authentication with JWT tokens.

### POST `/api/auth/request-otp`
Request OTP for a phone number. Creates user if doesn't exist.
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
  "user": { "id": "uuid", "phone": "9876543210", "role": "user" }
}
```

### GET `/api/auth/me` *(Auth Required)*
Get current user info. Include `Authorization: Bearer <token>` header.

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

```json
{
  "name": "Jane Smith",
  "gstin": "...",
  "phone": "9999999999",
  "email": "jane@example.com",
  "address": { "line1": "...", "city": "...", "pincode": "..." }
}
```

---

## Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List (filters: `?type=product`, `?categoryId=uuid`) |
| GET | `/api/products/:id` | Get with images |
| POST | `/api/products` | Create |
| PUT | `/api/products/:id` | Update |
| DELETE | `/api/products/:id` | Soft delete |
| POST | `/api/products/:id/images` | Upload image |
| DELETE | `/api/products/:productId/images/:imageId` | Delete image |

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

Same schema as Customers.

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
