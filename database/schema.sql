-- =============================================================
-- Car Parts B2B Store - MySQL Schema (MVP)
-- Target: car parts retail + B2B (wholesale / workshop) for AR
-- Engine : InnoDB (FK + transactions)
-- Charset: utf8mb4
-- NOTE   : requires MySQL 8.0.16+ for CHECK constraint enforcement
-- =============================================================

CREATE DATABASE IF NOT EXISTS car_parts
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE car_parts;

-- Re-run safe: drop in reverse dependency order.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS product_compatibility;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS manufacturers;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS engines;
DROP TABLE IF EXISTS vehicle_models;
DROP TABLE IF EXISTS vehicle_brands;
DROP TABLE IF EXISTS categories;
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- CATALOG
-- =============================================================

-- -------------------------------------------------------------
-- categories: hierarchical (parent_id self-FK).
-- name is the technical EN label; display_name is the ES UI label.
-- -------------------------------------------------------------
CREATE TABLE categories (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id    INT UNSIGNED NULL,
  name         VARCHAR(100) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  slug         VARCHAR(160) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_parent (parent_id),
  KEY idx_categories_active (is_active),
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_id) REFERENCES categories (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- manufacturers: brand of the PART (Bosch, Ferodo, NGK, ...).
-- Distinct from vehicle_brands.
-- -------------------------------------------------------------
CREATE TABLE manufacturers (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  country    VARCHAR(60) NULL,
  website    VARCHAR(255) NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manufacturers_name (name),
  UNIQUE KEY uq_manufacturers_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- VEHICLES & COMPATIBILITY
-- =============================================================

-- -------------------------------------------------------------
-- vehicle_brands: brand of the VEHICLE (Ford, Toyota, ...).
-- -------------------------------------------------------------
CREATE TABLE vehicle_brands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_brands_name (name),
  UNIQUE KEY uq_vehicle_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- vehicle_models: Fiesta, Corolla, Amarok, ...
-- -------------------------------------------------------------
CREATE TABLE vehicle_models (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  brand_id   INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(140) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_models_brand_name (brand_id, name),
  UNIQUE KEY uq_vehicle_models_slug (slug),
  CONSTRAINT fk_vehicle_models_brand
    FOREIGN KEY (brand_id) REFERENCES vehicle_brands (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- engines: normalized so the same engine block (shared across
-- models and brands) is not repeated as free text.
-- -------------------------------------------------------------
CREATE TABLE engines (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(50) NOT NULL,
  displacement_cc INT UNSIGNED NOT NULL,
  fuel_type       ENUM('gasoline','diesel','flex','cng','hybrid','ev') NOT NULL,
  horsepower      SMALLINT UNSIGNED NULL,
  description     VARCHAR(255) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_engines_code (code),
  KEY idx_engines_fuel (fuel_type),
  CONSTRAINT chk_engines_displacement CHECK (displacement_cc > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- vehicles: concrete fitment unit. Each row = a "generation"
-- (model + engine + trim + year range + body type).
-- Compatibility links to this row, not to a single year.
-- -------------------------------------------------------------
CREATE TABLE vehicles (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  model_id   INT UNSIGNED NOT NULL,
  engine_id  INT UNSIGNED NOT NULL,
  trim       VARCHAR(80) NULL,
  body_type  ENUM('sedan','hatchback','pickup','suv','coupe','wagon','van','convertible','minivan') NOT NULL,
  year_from  SMALLINT UNSIGNED NOT NULL,
  year_to    SMALLINT UNSIGNED NULL,
  notes      VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_model_engine_trim_year (model_id, engine_id, trim, year_from),
  KEY idx_vehicles_engine (engine_id),
  KEY idx_vehicles_year_range (year_from, year_to),
  KEY idx_vehicles_body_type (body_type),
  CONSTRAINT fk_vehicles_model
    FOREIGN KEY (model_id) REFERENCES vehicle_models (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_vehicles_engine
    FOREIGN KEY (engine_id) REFERENCES engines (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_vehicles_year_from  CHECK (year_from BETWEEN 1950 AND 2100),
  CONSTRAINT chk_vehicles_year_to    CHECK (year_to IS NULL OR year_to BETWEEN 1950 AND 2100),
  CONSTRAINT chk_vehicles_year_range CHECK (year_to IS NULL OR year_to >= year_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- PRODUCTS
-- =============================================================

-- -------------------------------------------------------------
-- products: sellable SKUs.
-- price / cost with explicit currency (ARS by default).
-- stock_reserved represents units locked by pending orders.
-- -------------------------------------------------------------
CREATE TABLE products (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id       INT UNSIGNED NOT NULL,
  manufacturer_id   INT UNSIGNED NOT NULL,
  sku               VARCHAR(60) NOT NULL,
  part_number       VARCHAR(80) NULL,
  slug              VARCHAR(200) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  short_description VARCHAR(500) NULL,
  description       TEXT NULL,
  price             DECIMAL(12,2) NOT NULL,
  cost              DECIMAL(12,2) NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'ARS',
  stock             INT NOT NULL DEFAULT 0,
  stock_reserved    INT NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_mfr_partnumber (manufacturer_id, part_number),
  KEY idx_products_category_active (category_id, is_active),
  KEY idx_products_part_number (part_number),
  FULLTEXT KEY ft_products_search (name, short_description, description),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_products_manufacturer
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_products_price     CHECK (price >= 0),
  CONSTRAINT chk_products_cost      CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT chk_products_stock     CHECK (stock >= 0),
  CONSTRAINT chk_products_reserved  CHECK (stock_reserved >= 0 AND stock_reserved <= stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- product_images: 1:N. Backend is responsible for ensuring
-- a single is_primary=1 per product (MySQL has no partial index).
-- -------------------------------------------------------------
CREATE TABLE product_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  alt_text   VARCHAR(200) NULL,
  position   INT NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_primary (product_id, is_primary),
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- product_compatibility: N:M between products and vehicles.
-- position enumerates fitment location; notes allows a short
-- free-text clarifier (e.g. "only with ABS").
-- -------------------------------------------------------------
CREATE TABLE product_compatibility (
  product_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  position   ENUM(
               'front','rear','left','right',
               'front_left','front_right','rear_left','rear_right',
               'universal'
             ) NOT NULL DEFAULT 'universal',
  notes      VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, vehicle_id),
  KEY idx_compat_vehicle (vehicle_id),
  KEY idx_compat_position (position),
  CONSTRAINT fk_compat_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_compat_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- SALES
-- =============================================================

-- -------------------------------------------------------------
-- customers: retail + B2B. business_name is used for wholesale
-- and workshop segments; contact_name is always required.
-- -------------------------------------------------------------
CREATE TABLE customers (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_type   ENUM('retail','wholesale','workshop') NOT NULL DEFAULT 'retail',
  business_name   VARCHAR(200) NULL,
  contact_name    VARCHAR(200) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  phone           VARCHAR(40) NULL,
  document_type   ENUM('DNI','CUIT','CUIL','PASSPORT') NOT NULL,
  document_number VARCHAR(20) NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email),
  UNIQUE KEY uq_customers_document (document_type, document_number),
  KEY idx_customers_type (customer_type),
  KEY idx_customers_business (business_name),
  KEY idx_customers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- orders: payment status and fulfillment status are independent.
-- customer_* fields are snapshots at order time (so the order
-- survives customer data edits). Shipping address is flattened
-- for MVP (no separate addresses table yet).
-- -------------------------------------------------------------
CREATE TABLE orders (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code           VARCHAR(30) NOT NULL,
  customer_id          INT UNSIGNED NULL,

  customer_name        VARCHAR(200) NOT NULL,
  customer_email       VARCHAR(150) NOT NULL,
  customer_phone       VARCHAR(40) NULL,

  subtotal             DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  total                DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency             CHAR(3) NOT NULL DEFAULT 'ARS',

  payment_status       ENUM('pending','authorized','paid','refunded','failed')
                         NOT NULL DEFAULT 'pending',
  fulfillment_status   ENUM('not_shipped','preparing','shipped','delivered','returned','cancelled')
                         NOT NULL DEFAULT 'not_shipped',

  payment_method       VARCHAR(50) NULL,
  payment_reference    VARCHAR(100) NULL,
  shipping_method      VARCHAR(50) NULL,
  tracking_number      VARCHAR(100) NULL,

  shipping_street      VARCHAR(200) NULL,
  shipping_number      VARCHAR(20)  NULL,
  shipping_floor       VARCHAR(40)  NULL,
  shipping_city        VARCHAR(100) NULL,
  shipping_province    VARCHAR(100) NULL,
  shipping_postal_code VARCHAR(20)  NULL,
  shipping_country     CHAR(2) NOT NULL DEFAULT 'AR',
  shipping_notes       VARCHAR(500) NULL,

  notes                VARCHAR(500) NULL,

  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at              DATETIME NULL,
  shipped_at           DATETIME NULL,
  delivered_at         DATETIME NULL,
  cancelled_at         DATETIME NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_code (order_code),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_customer_email (customer_email),
  KEY idx_orders_payment_status (payment_status),
  KEY idx_orders_fulfillment_status (fulfillment_status),
  KEY idx_orders_created_at (created_at),

  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT chk_orders_subtotal  CHECK (subtotal        >= 0),
  CONSTRAINT chk_orders_tax       CHECK (tax_amount      >= 0),
  CONSTRAINT chk_orders_shipping  CHECK (shipping_cost   >= 0),
  CONSTRAINT chk_orders_discount  CHECK (discount_amount >= 0),
  CONSTRAINT chk_orders_total     CHECK (total           >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- order_items: one line per product.
-- Snapshots keep historical orders readable even if a product
-- is later renamed or deactivated.
-- line_total = unit_price * quantity - discount_amount
-- (enforced in backend; constraint only checks non-negativity).
-- -------------------------------------------------------------
CREATE TABLE order_items (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id              INT UNSIGNED NOT NULL,
  product_id            INT UNSIGNED NOT NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  product_sku_snapshot  VARCHAR(60)  NOT NULL,
  quantity              INT NOT NULL,
  unit_price            DECIMAL(12,2) NOT NULL,
  discount_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total            DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order   (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_order_items_qty      CHECK (quantity        >  0),
  CONSTRAINT chk_order_items_price    CHECK (unit_price      >= 0),
  CONSTRAINT chk_order_items_discount CHECK (discount_amount >= 0),
  CONSTRAINT chk_order_items_line     CHECK (line_total      >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
