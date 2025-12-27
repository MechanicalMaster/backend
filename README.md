# Swipe Backend Service

> ⚠️ **Requires Node.js v18 LTS** - better-sqlite3 does not compile on Node.js v23+  
> See [NODE_VERSION_REQUIRED.md](NODE_VERSION_REQUIRED.md) for setup instructions.

Local-first backend service for the Swipe Invoice application, built with Node.js, Express, and SQLite.

## Features

- ✅ **Aggregate-based API** - Invoice aggregates assembled from normalized database tables
- ✅ **Transactional operations** - ACID compliance with SQLite WAL mode
- ✅ **Server-side authority** - Totals and balances computed server-side
- ✅ **Idempotency support** - Duplicate prevention via request IDs
- ✅ **Photo storage** - Local filesystem storage with checksums
- ✅ **Audit logging** - Complete audit trail for all mutations
- ✅ **Soft deletes** - Data preservation with recovery capability

## Architecture

The backend implements an **aggregate pattern** where complex business objects (InvoiceAggregate) are assembled from multiple normalized tables:

```
InvoiceAggregate = invoices + invoice_customer_snapshot + invoice_items + invoice_totals + invoice_photos
```

This allows the API to remain clean and business-focused while maintaining relational integrity internally.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your configuration
```

**Required Environment Variables:**
- `DATABASE_PATH` - SQLite database file path
- `STORAGE_PATH` - Photo storage directory
- `JWT_SECRET` - Secret key for JWT authentication
- `PORT` - Server port (default: 3000)

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will initialize the database schema automatically on first run.

## API Endpoints

Base URL: `http://localhost:3000/api`

### Health Check
- `GET /health` - Server health status

### Invoices (Aggregate API)
- `GET /api/invoices` - List all invoices (headers only)
- `GET /api/invoices/:id` - Get fully assembled invoice aggregate
- `POST /api/invoices` - Create invoice (supports `X-Request-Id` header for idempotency)
- `PUT /api/invoices/:id` - Update invoice (full replacement)
- `DELETE /api/invoices/:id` - Soft delete invoice
- `POST /api/invoices/:id/photos` - Upload invoice photo
- `DELETE /api/invoices/:invoiceId/photos/:photoId` - Delete invoice photo

### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Soft delete customer

### Products
- `GET /api/products` - List products (supports `?type=` and `?categoryId=` filters)
- `GET /api/products/:id` - Get product with images
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete product
- `POST /api/products/:id/images` - Upload product image
- `DELETE /api/products/:productId/images/:imageId` - Delete product image

### Payments
- `GET /api/payments` - List payments (supports `?partyId=` and `?type=` filters)
- `GET /api/payments/:id` - Get payment with allocations
- `POST /api/payments` - Create payment with allocations (updates invoice statuses and balances)
- `DELETE /api/payments/:id` - Delete payment (recalculates balances)

### Photos
- `GET /api/photos/:id` - Serve photo file

### Settings
- `GET /api/settings` - Get all settings
- `GET /api/settings/:key` - Get single setting
- `PUT /api/settings/:key` - Set a setting value

## Database

The backend uses **SQLite** with:
- **WAL mode** for better concurrency
- **Foreign key constraints** enabled
- **22 normalized tables** for relational integrity
- **Automatic schema initialization**

Database file location: configured via `DATABASE_PATH` (default: `./swipe.db`)

## File Storage

Photos are stored on the local filesystem with:
- UUID-based filenames for uniqueness
- SHA-256 checksums for integrity
- Path abstraction (clients never see filesystem paths)

Storage location: configured via `STORAGE_PATH` (default: `./storage/photos`)

## Key Design Principles

1. **Single Process Architecture** - Better-SQLite3 is synchronous; do not use clustering or worker threads
2. **Server-Side Authority** - All financial calculations performed server-side; client values ignored
3. **Derived Balances** - Balances are computed from ledger, not incremented blindly
4. **Idempotency** - Invoice creation supports request IDs to prevent duplicates
5. **Transactional Integrity** - All mutations happen within database transactions

## Production Deployment

### Environment Variables (Mandatory in Production)

```bash
NODE_ENV=production
DATABASE_PATH=/path/to/production/swipe.db  # REQUIRED
STORAGE_PATH=/path/to/production/photos     # REQUIRED
JWT_SECRET=long-random-secret-key           # REQUIRED
PORT=3000
MIGRATION_ENABLED=false                      # Disable after initial migration
```

### Security Considerations

- Run on local network only (not exposed to internet by default)
- Use Cloudflare Tunnel if remote access is needed (requires explicit setup)
- Set strong `JWT_SECRET` in production
- Keep `MIGRATION_ENABLED=false` after initial data migration

## Error Handling

All errors return consistent JSON format:

```json
{
  "error": "Error message",
  "details": {},
  "requestId": "uuid"
}
```

- **400** - Validation errors
- **404** - Resource not found
- **500** - Internal server error

## Testing

```bash
npm test
```

Tests cover:
- Database initialization
- Invoice aggregate assembly/decomposition
- Transactional integrity
- Payment allocation logic
- Idempotency keys

## Future Enhancements

- [ ] IndexedDB migration endpoint
- [ ] User authentication module
- [ ] Vendor CRUD endpoints
- [ ] Category/subcategory endpoints
- [ ] Bulk import/export
- [ ] Cloud backup sync

## Support

For issues or questions, refer to the implementation plan or contact the development team.

---

**Version:** 1.0.0  
**License:** ISC
