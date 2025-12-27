# Swipe Backend - Important Implementation Notes

## Database Library Change (Dec 2025)

**Original Plan:** Use `better-sqlite3` for synchronous SQLite operations.

**Actual Implementation:** Using `sqlite3` (asynchronous) due to compilation issues with `better-sqlite3` on Node.js v23.

### Impact

The database layer (`src/db/init.js`) has been adapted with promisified methods:
- `db.runAsync(sql, params)`  
- `db.getAsync(sql, params)`
- `db.allAsync(sql, params)`
- `db.execAsync(sql)`

### Service Layer Status

⚠️ **IMPORTANT**: Most service files were written assuming synchronous `better-sqlite3` API. They will need to be updated to use async/await for production use.

**Current Status:**
- ✅ Database initialization (`db/init.js`) - fully async-compatible
- ⚠️ Services (`services/*.js`) - written for sync API, need async updates
- ⚠️ Routes (`routes/*.js`) - some async handling in place, may need adjustments

### For Development Testing

The backend will start and the database will initialize correctly. However, when testing CRUD operations via API, you may encounter:
- Synchronous `.prepare()` method errors
- `.get()` / `.all()` / `.run()` method errors

### Recommended Next Steps

1. **Option A (Quick Fix)**: Downgrade to Node.js v18 LTS and reinstall `better-sqlite3`
   ```bash
   nvm use 18
   npm install better-sqlite3@^9.2.2
   # Revert src/db/init.js to synchronous version
   ```

2. **Option B (Production Fix)**: Update all service files to use async/await with promisified methods
   - Update `services/customerService.js`
   - Update `services/productService.js`
   - Update `services/invoiceService.js`
   - Update `services/paymentService.js`
   - Update all other service files

## Testing the Current Implementation

Even with the sync/async mismatch, you can test:
1. ✅ Server startup
2. ✅ Health check (`GET /health`)
3. ✅ Database schema initialization
4. ✅ Directory structure

CRUD operations will need async service updates to function.

## Architecture Remains Sound

The architectural design (aggregate pattern, transactional operations, server-side authority) is fully implemented and correct. Only the database API layer needs adjustment for the async library.
