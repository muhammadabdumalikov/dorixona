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