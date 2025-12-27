
---

# Backend Specification

## 1. Purpose (unchanged)

Build a **local-first backend service** for the Swipe Invoice application to replace IndexedDB, support multi-user LAN access, safely store photos, and enable future cloud backup/sync without frontend rewrites.

Frontend is deployed on Vercel and must remain storage-agnostic.

---

## 2. Architectural Principles (unchanged, clarified)

* Frontend **never** accesses database or filesystem directly.
* Backend is the **single source of truth**.
* Storage implementation (SQLite today, Postgres later) must be opaque to clients.
* API exposes **business objects**, not database tables.

---

## 3. Canonical Data Model (NEW – REQUIRED)

The backend maintains a **canonical relational data model** (see attached SQLite DDL).
However, the API does **not** expose tables directly.

Instead, the backend assembles and persists **Aggregate Objects**.

### 3.1 Aggregate Definitions

#### InvoiceAggregate (authoritative API shape)

An invoice is defined as the composition of:

* Invoice header
* Customer snapshot (historical)
* Line items
* Calculated totals
* Attached photos

This aggregate is **assembled on read** and **decomposed transactionally on write**.

The frontend continues to work with a single invoice object and is unaware of internal normalization.

---

## 4. API Assembly & Persistence Rules (NEW)

### Reads

* `GET /invoices/:id`:

  * MUST assemble data from:

    * invoices
    * invoice_customer_snapshot
    * invoice_items
    * invoice_totals
    * invoice_photos
  * MUST return a single InvoiceAggregate object.

### Writes

* `POST /invoices`, `PUT /invoices/:id`:

  * MUST execute inside a single DB transaction.
  * MUST validate payload before any write.
  * MUST recompute derived fields server-side (totals, balances).
  * MUST reject partial persistence (no half-written invoices).

Frontend never writes child entities directly.

---

## 5. Data Ownership & Authority (NEW)

* Backend owns:

  * UUID generation
  * Invoice numbers / sequences
  * Timestamps (`created_at`, `updated_at`)
  * Derived financial fields
* Frontend is treated as an **untrusted client**.
* Client-sent calculated values are ignored or recomputed.

---

## 6. Mutation Semantics (NEW)

* All deletes are **soft deletes** (`deleted_at`).
* Updates use **full-object replacement** or explicit PATCH endpoints.
* Migration and bulk-import endpoints must be **idempotent**.
* IDs are immutable once created.

---

## 7. Storage & Media Rules (unchanged, enforced)

* SQLite runs in WAL mode.
* Photos are stored on local filesystem, never as BLOBs.
* Database file and photo directories must be on local disk only.
* File paths are never exposed directly to clients.

---

## 8. Migration Support (unchanged, clarified)

* Backend provides a one-time migration API to import IndexedDB data.
* Migration logic maps legacy IDs to new UUIDs.
* Embedded objects from IndexedDB are split into canonical tables.
* Migration must be retry-safe and transactional.

---

## 9. Testing & Validation (unchanged)

(Refer to previously defined bare-minimum testing requirements; no changes required.)

---

## 10. Non-Goals (unchanged)

* No direct table-level APIs
* No cloud dependency
* No syncing SQLite files
* No frontend schema assumptions

---

## Reference

**Appendix A:** SQLite Canonical DDL (authoritative storage reference)

---

Below is a **production-grade SQLite DDL** for your **new backend**, derived from your IndexedDB schema but **corrected for relational integrity, migration safety, and future cloud sync**.

This DDL is intentionally:

* **UUID-based**
* **Normalized where correctness matters**
* **Denormalized only where historically necessary**
* **SQLite-safe (WAL, FK, CHECKs)**

---

## 0. Global SQLite settings (must be applied at startup)

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```

---

## 1. Core reference tables

### users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('ADMIN','USER')) NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
```

---

## 2. Customers & Vendors

### customers

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  balance REAL NOT NULL DEFAULT 0,
  address_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### vendors

```sql
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  balance REAL NOT NULL DEFAULT 0,
  address_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

---

## 3. Products & Catalog

### categories

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL
);
```

### subcategories

```sql
CREATE TABLE subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### products

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('product','service')) NOT NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  hsn TEXT,
  category_id TEXT,
  subcategory_id TEXT,
  description TEXT,
  selling_price REAL,
  purchase_price REAL,
  tax_rate REAL,
  unit TEXT,

  metal_json TEXT,
  gemstone_json TEXT,
  design_json TEXT,

  vendor_ref TEXT,
  procurement_date TEXT,
  hallmark_cert TEXT,
  launch_date TEXT,

  show_online INTEGER DEFAULT 0,
  not_for_sale INTEGER DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,

  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);
```

### product_images

```sql
CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 4. Invoices (canonical structure)

### invoices

```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  type TEXT CHECK(type IN ('INVOICE','PROFORMA','LENDING')) NOT NULL,
  status TEXT CHECK(status IN ('PAID','PARTIAL','UNPAID','PENDING')) NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  place_of_supply TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,

  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### invoice_customer_snapshot (historical truth)

```sql
CREATE TABLE invoice_customer_snapshot (
  invoice_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  gstin TEXT,
  address_json TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### invoice_items

```sql
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  description TEXT,
  quantity REAL NOT NULL,
  rate REAL NOT NULL,
  tax_rate REAL,
  weight_json TEXT,
  amount_json TEXT,

  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### invoice_totals

```sql
CREATE TABLE invoice_totals (
  invoice_id TEXT PRIMARY KEY,
  subtotal REAL NOT NULL,
  tax_total REAL NOT NULL,
  cgst REAL,
  sgst REAL,
  igst REAL,
  round_off REAL,
  grand_total REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### invoice_photos

```sql
CREATE TABLE invoice_photos (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

---

## 5. Purchases (mirrors invoices)

### purchases

```sql
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  purchase_number TEXT UNIQUE NOT NULL,
  vendor_id TEXT,
  status TEXT CHECK(status IN ('PAID','PARTIAL','UNPAID')) NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,

  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);
```

---

## 6. Payments & Allocations

### payments

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  transaction_number TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  type TEXT CHECK(type IN ('IN','OUT')) NOT NULL,
  party_type TEXT CHECK(party_type IN ('CUSTOMER','VENDOR')) NOT NULL,
  party_id TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### payment_allocations

```sql
CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

---

## 7. Sequences & Settings

### sequences

```sql
CREATE TABLE sequences (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
```

### settings

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
```

---

## 8. Audit & Operational Logs

### audit_logs

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
```

### attendance_logs

```sql
CREATE TABLE attendance_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login_date TEXT NOT NULL,
  login_at TEXT NOT NULL,
  logout_at TEXT,
  created_at TEXT NOT NULL
);
```

### bulk_upload_logs

```sql
CREATE TABLE bulk_upload_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_records INTEGER,
  success_count INTEGER,
  failure_count INTEGER,
  created_at TEXT NOT NULL
);
```

---
