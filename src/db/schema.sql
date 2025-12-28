-- SQLite Canonical DDL for Swipe Invoice Backend
-- Multi-Tenant Architecture: All business data is scoped by shop_id
-- This schema is the authoritative storage reference

-- 0. Global SQLite settings (must be applied at startup via PRAGMA)
-- PRAGMA journal_mode = WAL;
-- PRAGMA synchronous = NORMAL;
-- PRAGMA foreign_keys = ON;

-- 1. Shops (Tenants)
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 2. Users (belong to exactly one shop)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT CHECK(role IN ('ADMIN','SALES')) NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 3. Customers (shop-scoped)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  balance REAL NOT NULL DEFAULT 0,
  address_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 4. Vendors (shop-scoped)
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  balance REAL NOT NULL DEFAULT 0,
  address_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 5. Categories (shop-scoped)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 6. Subcategories
CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 7. Products (shop-scoped)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('product','service')) NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
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

  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- 8. Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 9. Invoices (shop-scoped)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  customer_id TEXT,
  type TEXT CHECK(type IN ('INVOICE','PROFORMA','LENDING')) NOT NULL,
  status TEXT CHECK(status IN ('PAID','PARTIAL','UNPAID','PENDING')) NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  place_of_supply TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,

  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  UNIQUE(shop_id, invoice_number)
);

-- 10. Invoice Customer Snapshot (historical truth)
CREATE TABLE IF NOT EXISTS invoice_customer_snapshot (
  invoice_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  gstin TEXT,
  address_json TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- 11. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
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

-- 12. Invoice Totals
CREATE TABLE IF NOT EXISTS invoice_totals (
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

-- 13. Invoice Photos
CREATE TABLE IF NOT EXISTS invoice_photos (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- 14. Purchases (shop-scoped)
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  purchase_number TEXT NOT NULL,
  vendor_id TEXT,
  status TEXT CHECK(status IN ('PAID','PARTIAL','UNPAID')) NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,

  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  UNIQUE(shop_id, purchase_number)
);

-- 15. Payments (shop-scoped)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  transaction_number TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT CHECK(type IN ('IN','OUT')) NOT NULL,
  party_type TEXT CHECK(party_type IN ('CUSTOMER','VENDOR')) NOT NULL,
  party_id TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  UNIQUE(shop_id, transaction_number)
);

-- 16. Payment Allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- 17. Sequences (per-shop, composite key)
CREATE TABLE IF NOT EXISTS sequences (
  shop_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (shop_id, key),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 18. Settings (shop-scoped)
CREATE TABLE IF NOT EXISTS settings (
  shop_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (shop_id, key),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 19. Audit Logs (shop-scoped with actor tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

-- 20. Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login_date TEXT NOT NULL,
  login_at TEXT NOT NULL,
  logout_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 21. Bulk Upload Logs
CREATE TABLE IF NOT EXISTS bulk_upload_logs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_records INTEGER,
  success_count INTEGER,
  failure_count INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 22. Idempotency Keys (for duplicate prevention)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  request_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 23. Migration ID Map (for IndexedDB migration)
CREATE TABLE IF NOT EXISTS migration_id_map (
  old_id TEXT NOT NULL,
  new_uuid TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  PRIMARY KEY (old_id, entity_type)
);

-- Indexes for performance (shop_id scoping)
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_shop ON vendors(shop_id);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted ON vendors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_shop ON categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_shop ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_shop ON purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_photos_invoice ON invoice_photos(invoice_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);
