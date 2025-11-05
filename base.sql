-- Medicine Alternative Finder Database Schema for Uzbekistan
-- Optimized for NestJS + PostgreSQL

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- 1. Active Ingredients (International/Generic Names)
CREATE TABLE active_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., "Azithromycin", "Oxymetazoline"
    name_latin VARCHAR(255), -- Latin version if different
    name_uzbek VARCHAR(255), -- Uzbek translation
    atc_code VARCHAR(20), -- Anatomical Therapeutic Chemical code (e.g., J01FA10 for Azithromycin)
    therapeutic_class VARCHAR(255), -- e.g., "Antibiotic", "Decongestant"
    description TEXT,
    warnings TEXT, -- Special warnings about this ingredient
    is_narrow_therapeutic_index BOOLEAN DEFAULT false, -- Critical: not all generics are interchangeable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Manufacturers/Companies
CREATE TABLE manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    is_local BOOLEAN DEFAULT false, -- Uzbek manufacturer or not
    reliability_rating DECIMAL(3,2), -- Optional: 1-5 rating
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dosage Forms
CREATE TABLE dosage_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL UNIQUE, -- e.g., "Tablet", "Capsule", "Syrup", "Injection"
    name_uzbek VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Medicines (Main table)
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_name VARCHAR(255) NOT NULL, -- Brand name (e.g., "Sumamed")
    registration_number VARCHAR(100) UNIQUE, -- Uzbekistan registration number
    manufacturer_id UUID REFERENCES manufacturers(id),
    dosage_form_id UUID REFERENCES dosage_forms(id),
    
    -- Strength/Dosage
    strength VARCHAR(100), -- e.g., "500mg", "0.05%"
    strength_numeric DECIMAL(10,4), -- Numeric value for comparison (500)
    strength_unit VARCHAR(20), -- mg, g, %, IU, etc.
    
    -- Packaging
    package_size VARCHAR(100), -- e.g., "10 tablets", "100ml bottle"
    package_quantity INTEGER, -- Numeric quantity (10, 100)
    
    -- Pricing (you'll add this later)
    price_uzs DECIMAL(12,2), -- Price in Uzbek Som
    price_last_updated TIMESTAMP,
    
    -- Additional info
    prescription_required BOOLEAN DEFAULT true,
    is_generic BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    barcode VARCHAR(50),
    
    -- Registration details
    registration_date DATE,
    expiry_date DATE, -- Registration expiry
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Medicine-Active Ingredient relationship (Many-to-Many)
-- Because some medicines contain multiple active ingredients (combinations)
CREATE TABLE medicine_active_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    active_ingredient_id UUID REFERENCES active_ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10,4), -- Amount of this ingredient
    quantity_unit VARCHAR(20), -- mg, g, etc.
    is_primary BOOLEAN DEFAULT true, -- Main ingredient or auxiliary
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medicine_id, active_ingredient_id)
);

-- 6. Pharmacies (for future: price comparison across pharmacies)
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    chain_name VARCHAR(255), -- If part of chain
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    phone VARCHAR(50),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Medicine Prices by Pharmacy (for future expansion)
CREATE TABLE medicine_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
    price_uzs DECIMAL(12,2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER,
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medicine_id, pharmacy_id)
);

-- 8. User Searches (Analytics & ML)
CREATE TABLE user_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_query VARCHAR(500) NOT NULL,
    medicine_id UUID REFERENCES medicines(id), -- If they selected a specific medicine
    user_ip VARCHAR(45), -- For basic analytics
    user_agent TEXT,
    results_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Therapeutic Equivalence Groups (Optional but recommended)
CREATE TABLE equivalence_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    active_ingredient_id UUID REFERENCES active_ingredients(id),
    description TEXT,
    bioequivalence_note TEXT, -- Important medical info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medicine_equivalence (
    equivalence_group_id UUID REFERENCES equivalence_groups(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    equivalence_rating VARCHAR(20), -- 'A', 'B', 'AB' ratings if available
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (equivalence_group_id, medicine_id)
);

-- ============================================
-- ERP MODULE: Multi-Tenancy & Authentication
-- ============================================

-- 10. Tenants (Pharmacy Organizations)
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'PHARMACY_ADMIN',
    'PHARMACIST',
    'CASHIER',
    'MANAGER'
);

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Users (Authentication & Authorization)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'CASHIER',
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ERP MODULE: Inventory Management
-- ============================================

-- 12. Warehouses (Storage Locations)
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Inventory Items (Stock per Medicine per Warehouse)
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_qty INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    max_stock INTEGER,
    cost_price DECIMAL(12,2),
    selling_price DECIMAL(12,2),
    batch_number VARCHAR(100),
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medicine_id, warehouse_id, batch_number)
);

-- 14. Stock Movements (Audit Trail)
CREATE TYPE stock_movement_type AS ENUM (
    'IN',
    'OUT',
    'ADJUSTMENT',
    'TRANSFER',
    'RETURN'
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    movement_type stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50), -- e.g., 'PURCHASE', 'SALE', 'ADJUSTMENT'
    reference_id UUID, -- ID of the related document
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ERP MODULE: Sales & POS
-- ============================================

-- 15. Sales (Sales Orders/Invoices - Anonymous Sales)
CREATE TYPE sale_status AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED'
);

CREATE TYPE payment_method AS ENUM (
    'CASH',
    'CARD',
    'TRANSFER',
    'MOBILE_PAYMENT'
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status sale_status NOT NULL DEFAULT 'COMPLETED',
    payment_method payment_method NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    final_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Sale Items (Line Items for each Sale)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Active Ingredients
CREATE INDEX idx_active_ingredients_name ON active_ingredients(name);
CREATE INDEX idx_active_ingredients_name_trgm ON active_ingredients USING gin(name gin_trgm_ops);
CREATE INDEX idx_active_ingredients_atc ON active_ingredients(atc_code);

-- Medicines
CREATE INDEX idx_medicines_trade_name ON medicines(trade_name);
CREATE INDEX idx_medicines_trade_name_trgm ON medicines USING gin(trade_name gin_trgm_ops);
CREATE INDEX idx_medicines_manufacturer ON medicines(manufacturer_id);
CREATE INDEX idx_medicines_dosage_form ON medicines(dosage_form_id);
CREATE INDEX idx_medicines_price ON medicines(price_uzs);
CREATE INDEX idx_medicines_available ON medicines(is_available);
CREATE INDEX idx_medicines_strength ON medicines(strength_numeric, strength_unit);

-- Medicine-Active Ingredients relationship
CREATE INDEX idx_med_active_medicine ON medicine_active_ingredients(medicine_id);
CREATE INDEX idx_med_active_ingredient ON medicine_active_ingredients(active_ingredient_id);

-- Prices
CREATE INDEX idx_prices_medicine ON medicine_prices(medicine_id);
CREATE INDEX idx_prices_pharmacy ON medicine_prices(pharmacy_id);
CREATE INDEX idx_prices_amount ON medicine_prices(price_uzs);

-- Searches
CREATE INDEX idx_searches_created ON user_searches(created_at);
CREATE INDEX idx_searches_medicine ON user_searches(medicine_id);

-- Tenants
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_active ON tenants(is_active);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Warehouses
CREATE INDEX idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX idx_warehouses_active ON warehouses(is_active);
CREATE INDEX idx_warehouses_code ON warehouses(code);

-- Inventory Items
CREATE INDEX idx_inventory_items_warehouse ON inventory_items(warehouse_id);
CREATE INDEX idx_inventory_items_medicine ON inventory_items(medicine_id);
CREATE INDEX idx_inventory_items_quantity ON inventory_items(quantity);
CREATE INDEX idx_inventory_items_expiry ON inventory_items(expiry_date);

-- Stock Movements
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_inventory_item ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_by ON stock_movements(created_by);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Sales
CREATE INDEX idx_sales_tenant ON sales(tenant_id);
CREATE INDEX idx_sales_warehouse ON sales(warehouse_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sales_number ON sales(sale_number);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);

-- Sale Items
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_inventory ON sale_items(inventory_item_id);
CREATE INDEX idx_sale_items_medicine ON sale_items(medicine_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_active_ingredients_updated_at BEFORE UPDATE ON active_ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON manufacturers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS for Common Queries
-- ============================================

-- View: Medicine with full details
CREATE VIEW v_medicines_full AS
SELECT 
    m.id,
    m.trade_name,
    m.registration_number,
    m.strength,
    m.package_size,
    m.price_uzs,
    m.is_generic,
    m.is_available,
    m.prescription_required,
    df.name as dosage_form,
    mf.name as manufacturer,
    mf.country as manufacturer_country,
    array_agg(DISTINCT ai.name) as active_ingredients,
    array_agg(DISTINCT ai.id) as active_ingredient_ids
FROM medicines m
LEFT JOIN dosage_forms df ON m.dosage_form_id = df.id
LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
LEFT JOIN medicine_active_ingredients mai ON m.id = mai.medicine_id
LEFT JOIN active_ingredients ai ON mai.active_ingredient_id = ai.id
GROUP BY m.id, df.name, mf.name, mf.country;

-- View: Cheapest alternatives by active ingredient
CREATE VIEW v_cheapest_alternatives AS
SELECT 
    ai.id as active_ingredient_id,
    ai.name as active_ingredient_name,
    m.id as medicine_id,
    m.trade_name,
    m.strength,
    m.price_uzs,
    df.name as dosage_form,
    mf.name as manufacturer,
    ROW_NUMBER() OVER (
        PARTITION BY ai.id, m.dosage_form_id, m.strength_numeric 
        ORDER BY m.price_uzs ASC
    ) as price_rank
FROM active_ingredients ai
JOIN medicine_active_ingredients mai ON ai.id = mai.active_ingredient_id
JOIN medicines m ON mai.medicine_id = m.id
LEFT JOIN dosage_forms df ON m.dosage_form_id = df.id
LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
WHERE m.is_available = true 
AND m.price_uzs IS NOT NULL;

-- ============================================
-- MOCK DATA FOR TESTING
-- ============================================

-- Insert sample tenant (pharmacy)
    INSERT INTO tenants (id, name, subdomain, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Toshkent Apteka', 'toshkent', true),
    ('00000000-0000-0000-0000-000000000002', 'Samarqand Apteka', 'samarqand', true)
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample users
    -- Password for all users: "password123" (bcrypt hash)
    -- Note: In production, use proper password hashing. This is for testing only.
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, tenant_id, is_active) VALUES
    -- Super Admin (no tenant)
    ('10000000-0000-0000-0000-000000000001', 'admin@pharmacy.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Super', 'Admin', 'SUPER_ADMIN', NULL, true),
    -- Pharmacy Admin
    ('10000000-0000-0000-0000-000000000002', 'admin@toshkent.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Ahmad', 'Karimov', 'PHARMACY_ADMIN', '00000000-0000-0000-0000-000000000001', true),
    -- Manager
    ('10000000-0000-0000-0000-000000000003', 'manager@toshkent.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Olim', 'Toshmatov', 'MANAGER', '00000000-0000-0000-0000-000000000001', true),
    -- Pharmacist
    ('10000000-0000-0000-0000-000000000004', 'pharmacist@toshkent.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Dilnoza', 'Rahimova', 'PHARMACIST', '00000000-0000-0000-0000-000000000001', true),
    -- Cashiers
    ('10000000-0000-0000-0000-000000000005', 'cashier1@toshkent.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Farida', 'Yusupova', 'CASHIER', '00000000-0000-0000-0000-000000000001', true),
    ('10000000-0000-0000-0000-000000000006', 'cashier2@toshkent.uz', '$2b$10$rOzJ5qJ5J5J5J5J5J5J5JOhK5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5', 'Javohir', 'Alimov', 'CASHIER', '00000000-0000-0000-0000-000000000001', true)
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample warehouses
    INSERT INTO warehouses (id, name, code, address, is_active, tenant_id) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Main Store', 'WH-001', 'Amir Temur ko''chasi 123, Toshkent', true, '00000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000002', 'Branch 1', 'WH-002', 'Navoiy ko''chasi 45, Toshkent', true, '00000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000003', 'Warehouse Samarkand', 'WH-SAM-001', 'Registon ko''chasi 78, Samarqand', true, '00000000-0000-0000-0000-000000000002')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample inventory items (only if medicines exist)
    -- Note: This will only insert if there are medicines in the database
    INSERT INTO inventory_items (
        id, medicine_id, warehouse_id, quantity, reserved_qty, reorder_point, max_stock,
        cost_price, selling_price, batch_number, expiry_date
    )
    SELECT 
        gen_random_uuid(),
        m.id,
        '20000000-0000-0000-0000-000000000001'::uuid, -- Main Store
        CASE 
            WHEN RANDOM() < 0.3 THEN (RANDOM() * 50)::int + 10  -- 30% chance of low stock
            ELSE (RANDOM() * 200)::int + 50  -- Normal stock
        END,
        0,
        20,
        500,
        COALESCE(m.price_uzs * 0.7, 10000), -- Cost price = 70% of selling price
        COALESCE(m.price_uzs, 15000), -- Selling price from medicine
        'BATCH-' || LPAD((RANDOM() * 9999)::int::text, 4, '0'),
        CURRENT_DATE + INTERVAL '1 year' + FLOOR(RANDOM() * 365) * INTERVAL '1 day'
    FROM medicines m
    WHERE m.is_available = true
    LIMIT 20
    ON CONFLICT DO NOTHING;

    -- Insert more inventory items for Branch 1
    INSERT INTO inventory_items (
        id, medicine_id, warehouse_id, quantity, reserved_qty, reorder_point, max_stock,
        cost_price, selling_price, batch_number, expiry_date
    )
    SELECT 
        gen_random_uuid(),
        m.id,
        '20000000-0000-0000-0000-000000000002'::uuid, -- Branch 1
        CASE 
            WHEN RANDOM() < 0.3 THEN (RANDOM() * 50)::int + 10
            ELSE (RANDOM() * 200)::int + 50
        END,
        0,
        15,
        300,
        COALESCE(m.price_uzs * 0.7, 10000),
        COALESCE(m.price_uzs, 15000),
        'BATCH-' || LPAD((RANDOM() * 9999)::int::text, 4, '0'),
        CURRENT_DATE + INTERVAL '1 year' + FLOOR(RANDOM() * 365) * INTERVAL '1 day'
    FROM medicines m
    WHERE m.is_available = true
    LIMIT 15
    ON CONFLICT DO NOTHING;

    -- Insert sample sales (only if inventory items exist)
    -- Note: This creates sample sales with items
    DO $$
    DECLARE
        sale_id UUID;
        v_sale_number VARCHAR(50);
        item_record RECORD;
        item_count INT;
        item_id UUID;
        item_price DECIMAL(12,2);
        item_quantity INT;
        v_subtotal DECIMAL(12,2);
        v_total_amount DECIMAL(12,2) := 0;
        v_final_amount DECIMAL(12,2);
        sale_date TIMESTAMP;
        warehouse_uuid UUID := '20000000-0000-0000-0000-000000000001'::uuid;
        user_uuid UUID := '10000000-0000-0000-0000-000000000005'::uuid; -- Cashier 1
        tenant_uuid UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    BEGIN
        -- Create 3 sample sales
        FOR i IN 1..3 LOOP
            sale_date := CURRENT_TIMESTAMP - (i * INTERVAL '1 day');
            v_sale_number := 'SALE-' || TO_CHAR(sale_date, 'YYYYMMDD') || '-' || LPAD(i::text, 4, '0');
            
            -- Create sale
            INSERT INTO sales (
                id, sale_number, warehouse_id, user_id, status, payment_method,
                total_amount, discount_amount, tax_amount, final_amount, notes, tenant_id, created_at
            ) VALUES (
                gen_random_uuid(),
                v_sale_number,
                warehouse_uuid,
                user_uuid,
                'COMPLETED'::sale_status,
                CASE (i % 4)
                    WHEN 0 THEN 'CASH'::payment_method
                    WHEN 1 THEN 'CARD'::payment_method
                    WHEN 2 THEN 'MOBILE_PAYMENT'::payment_method
                    ELSE 'TRANSFER'::payment_method
                END,
                0, -- Will be calculated
                0,
                0,
                0, -- Will be calculated
                'Sample sale for testing',
                tenant_uuid,
                sale_date
            ) RETURNING id INTO sale_id;
            
            -- Add 2-4 items to each sale
            item_count := 2 + (RANDOM() * 3)::int;
            v_total_amount := 0;
            
            FOR item_record IN 
                SELECT ii.id, ii.medicine_id, ii.selling_price, ii.quantity
                FROM inventory_items ii
                WHERE ii.warehouse_id = warehouse_uuid
                AND ii.quantity > 0
                ORDER BY RANDOM()
                LIMIT item_count
            LOOP
                item_quantity := LEAST(1 + (RANDOM() * 3)::int, item_record.quantity);
                item_price := COALESCE(item_record.selling_price, 15000);
                v_subtotal := item_price * item_quantity;
                v_total_amount := v_total_amount + v_subtotal;
                
                -- Create sale item
                INSERT INTO sale_items (
                    sale_id, inventory_item_id, medicine_id, quantity, unit_price,
                    discount_percent, discount_amount, tax_percent, tax_amount, subtotal
                ) VALUES (
                    sale_id,
                    item_record.id,
                    item_record.medicine_id,
                    item_quantity,
                    item_price,
                    0,
                    0,
                    0,
                    0,
                    v_subtotal
                );
                
                -- Update inventory (decrement quantity)
                UPDATE inventory_items 
                SET quantity = quantity - item_quantity
                WHERE id = item_record.id;
                
                -- Create stock movement
                INSERT INTO stock_movements (
                    inventory_item_id, warehouse_id, movement_type, quantity,
                    reference_type, reference_id, notes, created_by, created_at
                ) VALUES (
                    item_record.id,
                    warehouse_uuid,
                    'OUT'::stock_movement_type,
                    item_quantity,
                    'SALE',
                    sale_id,
                    'Sale ' || v_sale_number,
                    user_uuid,
                    sale_date
                );
            END LOOP;
            
            -- Update sale with final amounts
            v_final_amount := v_total_amount;
            UPDATE sales
            SET total_amount = v_total_amount,
                final_amount = v_final_amount
            WHERE id = sale_id;
        END LOOP;
    END $$;