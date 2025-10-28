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
    isLocal BOOLEAN DEFAULT false, -- Uzbek manufacturer or not
    reliabilityRating DECIMAL(3,2), -- Optional: 1-5 rating
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dosage Forms
CREATE TABLE dosage_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., "Tablet", "Capsule", "Syrup", "Injection"
    nameUzbek VARCHAR(100),
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Medicines (Main table)
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tradeName VARCHAR(255) NOT NULL, -- Brand name (e.g., "Sumamed")
    registrationNumber VARCHAR(100) UNIQUE, -- Uzbekistan registration number
    manufacturerId UUID REFERENCES manufacturers(id),
    dosageFormId UUID REFERENCES dosage_forms(id),
    
    -- Strength/Dosage
    strength VARCHAR(100), -- e.g., "500mg", "0.05%"
    strengthNumeric DECIMAL(10,4), -- Numeric value for comparison (500)
    strengthUnit VARCHAR(20), -- mg, g, %, IU, etc.
    
    -- Packaging
    packageSize VARCHAR(100), -- e.g., "10 tablets", "100ml bottle"
    packageQuantity INTEGER, -- Numeric quantity (10, 100)
    
    -- Pricing (you'll add this later)
    priceUzs DECIMAL(12,2), -- Price in Uzbek Som
    priceLastUpdated TIMESTAMP,
    
    -- Additional info
    prescriptionRequired BOOLEAN DEFAULT true,
    isGeneric BOOLEAN DEFAULT false,
    isAvailable BOOLEAN DEFAULT true,
    barcode VARCHAR(50),
    
    -- Registration details
    registrationDate DATE,
    expiryDate DATE, -- Registration expiry
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Medicine-Active Ingredient relationship (Many-to-Many)
-- Because some medicines contain multiple active ingredients (combinations)
CREATE TABLE medicine_active_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicineId UUID REFERENCES medicines(id) ON DELETE CASCADE,
    activeIngredientId UUID REFERENCES active_ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10,4), -- Amount of this ingredient
    quantityUnit VARCHAR(20), -- mg, g, etc.
    isPrimary BOOLEAN DEFAULT true, -- Main ingredient or auxiliary
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medicineId, activeIngredientId)
);

-- 6. Pharmacies (for future: price comparison across pharmacies)
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    chainName VARCHAR(255), -- If part of chain
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    phone VARCHAR(50),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Medicine Prices by Pharmacy (for future expansion)
CREATE TABLE medicine_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicineId UUID REFERENCES medicines(id) ON DELETE CASCADE,
    pharmacyId UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
    priceUzs DECIMAL(12,2) NOT NULL,
    isAvailable BOOLEAN DEFAULT true,
    stockQuantity INTEGER,
    lastVerified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medicineId, pharmacyId)
);

-- 8. User Searches (Analytics & ML)
CREATE TABLE user_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    searchQuery VARCHAR(500) NOT NULL,
    medicineId UUID REFERENCES medicines(id), -- If they selected a specific medicine
    userIp VARCHAR(45), -- For basic analytics
    userAgent TEXT,
    resultsCount INTEGER,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Therapeutic Equivalence Groups (Optional but recommended)
CREATE TABLE equivalence_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    activeIngredientId UUID REFERENCES active_ingredients(id),
    description TEXT,
    bioequivalenceNote TEXT, -- Important medical info
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medicine_equivalence (
    equivalenceGroupId UUID REFERENCES equivalence_groups(id) ON DELETE CASCADE,
    medicineId UUID REFERENCES medicines(id) ON DELETE CASCADE,
    equivalenceRating VARCHAR(20), -- 'A', 'B', 'AB' ratings if available
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (equivalenceGroupId, medicineId)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Active Ingredients
CREATE INDEX idx_active_ingredients_name ON active_ingredients(name);
CREATE INDEX idx_active_ingredients_name_trgm ON active_ingredients USING gin(name gin_trgm_ops);
CREATE INDEX idx_active_ingredients_atc ON active_ingredients(atcCode);

-- Medicines
CREATE INDEX idx_medicines_trade_name ON medicines(tradeName);
CREATE INDEX idx_medicines_trade_name_trgm ON medicines USING gin(tradeName gin_trgm_ops);
CREATE INDEX idx_medicines_manufacturer ON medicines(manufacturerId);
CREATE INDEX idx_medicines_dosage_form ON medicines(dosageFormId);
CREATE INDEX idx_medicines_price ON medicines(priceUzs);
CREATE INDEX idx_medicines_available ON medicines(isAvailable);
CREATE INDEX idx_medicines_strength ON medicines(strengthNumeric, strengthUnit);

-- Medicine-Active Ingredients relationship
CREATE INDEX idx_med_active_medicine ON medicine_active_ingredients(medicineId);
CREATE INDEX idx_med_active_ingredient ON medicine_active_ingredients(activeIngredientId);

-- Prices
CREATE INDEX idx_prices_medicine ON medicine_prices(medicineId);
CREATE INDEX idx_prices_pharmacy ON medicine_prices(pharmacyId);
CREATE INDEX idx_prices_amount ON medicine_prices(priceUzs);

-- Searches
CREATE INDEX idx_searches_created ON user_searches(createdAt);
CREATE INDEX idx_searches_medicine ON user_searches(medicineId);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
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
    m.tradeName,
    m.registrationNumber,
    m.strength,
    m.packageSize,
    m.priceUzs,
    m.isGeneric,
    m.isAvailable,
    m.prescriptionRequired,
    df.name as dosage_form,
    mf.name as manufacturer,
    mf.country as manufacturer_country,
    array_agg(DISTINCT ai.name) as active_ingredients,
    array_agg(DISTINCT ai.id) as active_ingredient_ids
FROM medicines m
LEFT JOIN dosage_forms df ON m.dosageFormId = df.id
LEFT JOIN manufacturers mf ON m.manufacturerId = mf.id
LEFT JOIN medicine_active_ingredients mai ON m.id = mai.medicineId
LEFT JOIN active_ingredients ai ON mai.activeIngredientId = ai.id
GROUP BY m.id, df.name, mf.name, mf.country;

-- View: Cheapest alternatives by active ingredient
CREATE VIEW v_cheapest_alternatives AS
SELECT 
    ai.id as active_ingredient_id,
    ai.name as active_ingredient_name,
    m.id as medicine_id,
    m.tradeName,
    m.strength,
    m.priceUzs,
    df.name as dosage_form,
    mf.name as manufacturer,
    ROW_NUMBER() OVER (
        PARTITION BY ai.id, m.dosageFormId, m.strengthNumeric 
        ORDER BY m.priceUzs ASC
    ) as price_rank
FROM active_ingredients ai
JOIN medicine_active_ingredients mai ON ai.id = mai.activeIngredientId
JOIN medicines m ON mai.medicineId = m.id
LEFT JOIN dosage_forms df ON m.dosageFormId = df.id
LEFT JOIN manufacturers mf ON m.manufacturerId = mf.id
WHERE m.isAvailable = true 
AND m.priceUzs IS NOT NULL;