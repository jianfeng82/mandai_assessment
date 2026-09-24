-- Database Schema Initialization for Product Management Assessment

CREATE DATABASE IF NOT EXISTS product_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE product_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Products Table (Strict Non-Negative Stock)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents INT UNSIGNED NOT NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_stock_non_negative CHECK (stock >= 0),
    INDEX idx_products_is_active (is_active),
    INDEX idx_products_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    total_cents INT UNSIGNED NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_orders_user_id (user_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_idempotency (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    unit_price_cents INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_items_order_id (order_id),
    INDEX idx_order_items_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Inventory Logs (Audit Ledger)
CREATE TABLE IF NOT EXISTS inventory_logs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    change_amount INT NOT NULL,
    balance_after INT UNSIGNED NOT NULL,
    reason ENUM('PURCHASE', 'ADMIN_RESTOCK', 'ADMIN_ADJUSTMENT', 'ORDER_CANCELLED') NOT NULL,
    reference_id VARCHAR(64) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_inventory_logs_product (product_id),
    INDEX idx_inventory_logs_reason (reason),
    INDEX idx_inventory_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Default Accounts
INSERT INTO users (id, email, password_hash, role) VALUES
('usr-admin-0000000000000000000000001', 'admin@example.com', '$2b$10$/i/3RnRzRjVBQ5emzv.xB.FANGaI0OYQ7XCdPVxxF0e602rVzdp76', 'ADMIN'),
('usr-cust-0000000000000000000000001', 'customer@example.com', '$2b$10$D01.2smYm9i/nS1qz803u.u7Gh6mOSSHIsxj7wBZ/Yoj7YXsb3Yd6', 'CUSTOMER')
ON DUPLICATE KEY UPDATE email = email;

-- Seed Products
INSERT INTO products (id, title, description, price_cents, stock, is_active) VALUES
('prod-flash-sale-switch-000000001', 'Limited Flash Sale Mechanical Switch Pack (10pcs)', 'High precision mechanical switches. Limited edition test product designed for high-concurrency race condition testing.', 4500, 10, TRUE),
('prod-headphone-anc-0000000000002', 'Studio Pro Wireless Noise-Cancelling Headphones', 'Active noise cancellation with 40-hour battery life and spatial audio capability.', 19999, 25, TRUE),
('prod-keyboard-rgb-0000000000003', 'Pro RGB Mechanical Gaming Keyboard', 'Custom mechanical switches with per-key RGB backlighting and aircraft-grade aluminum frame.', 12950, 15, TRUE),
('prod-monitor-4k-000000000000004', '34" Curved UltraWide 4K Gaming Monitor', '144Hz refresh rate, 1ms response time, HDR 600, USB-C 90W power delivery.', 49900, 8, TRUE),
('prod-chair-ergo-000000000000005', 'Ergonomic Mesh Task Office Chair', 'Breathable mesh back with dynamic lumbar support and 3D adjustable armrests.', 28900, 5, TRUE),
('prod-collector-figure-000000006', 'Cyberpunk Edition Collector Figurine (Sold Out)', 'Hand-painted 1/6 scale collectible statue with LED accents. Currently out of stock.', 9900, 0, TRUE)
ON DUPLICATE KEY UPDATE title = title;

-- Seed Initial Inventory Logs for audit trail
INSERT INTO inventory_logs (id, product_id, change_amount, balance_after, reason, reference_id) VALUES
('log-seed-0000000000000000000000001', 'prod-flash-sale-switch-000000001', 10, 10, 'ADMIN_RESTOCK', 'INITIAL_SEED'),
('log-seed-0000000000000000000000002', 'prod-headphone-anc-0000000000002', 25, 25, 'ADMIN_RESTOCK', 'INITIAL_SEED'),
('log-seed-0000000000000000000000003', 'prod-keyboard-rgb-0000000000003', 15, 15, 'ADMIN_RESTOCK', 'INITIAL_SEED'),
('log-seed-0000000000000000000000004', 'prod-monitor-4k-000000000000004', 8, 8, 'ADMIN_RESTOCK', 'INITIAL_SEED'),
('log-seed-0000000000000000000000005', 'prod-chair-ergo-000000000000005', 5, 5, 'ADMIN_RESTOCK', 'INITIAL_SEED')
ON DUPLICATE KEY UPDATE change_amount = change_amount;
