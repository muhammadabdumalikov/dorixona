# Pharmacy ERP - Step-by-Step API Usage Guide

This guide walks you through using the Pharmacy ERP system via REST APIs.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v12+)
- API client (Postman, curl, or Swagger UI)

---

## Step 1: Initial Setup

### 1.1 Install Dependencies

```bash
npm install
```

### 1.2 Configure Environment

Create `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/medicine_db"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=10
```

### 1.3 Setup Database

```bash
# Create database
createdb medicine_db

# Run schema
psql -d medicine_db -f base.sql

# Generate Prisma client
npx prisma generate
```

### 1.4 Start Server

```bash
npm run start:dev
```

Server will run at: `http://localhost:3000`
Swagger UI: `http://localhost:3000/api/docs`

---

## Step 2: Authentication

### 2.1 Register a New User

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "admin@pharmacy.uz",
  "password": "password123",
  "first_name": "Ahmad",
  "last_name": "Karimov",
  "role": "PHARMACY_ADMIN",
  "tenant_id": "00000000-0000-0000-0000-000000000001"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pharmacy.uz",
    "password": "password123",
    "first_name": "Ahmad",
    "last_name": "Karimov",
    "role": "PHARMACY_ADMIN",
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "user": {
    "id": "10000000-0000-0000-0000-000000000002",
    "email": "admin@pharmacy.uz",
    "first_name": "Ahmad",
    "last_name": "Karimov",
    "role": "PHARMACY_ADMIN",
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Save the `access_token`** - you'll need it for authenticated requests!

### 2.2 Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "admin@pharmacy.uz",
  "password": "password123"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pharmacy.uz",
    "password": "password123"
  }'
```

**Response:** Same as registration - returns JWT token and user info.

---

## Step 3: Warehouse Management

### 3.1 Create Warehouse

**Endpoint:** `POST /api/inventory/warehouses`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request:**
```json
{
  "name": "Main Store",
  "code": "WH-001",
  "address": "Amir Temur ko'chasi 123, Toshkent"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/inventory/warehouses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name": "Main Store",
    "code": "WH-001",
    "address": "Amir Temur ko'\''chasi 123, Toshkent"
  }'
```

**Response:**
```json
{
  "id": "20000000-0000-0000-0000-000000000001",
  "name": "Main Store",
  "code": "WH-001",
  "address": "Amir Temur ko'chasi 123, Toshkent",
  "is_active": true,
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "created_at": "2025-01-15T10:00:00.000Z",
  "updated_at": "2025-01-15T10:00:00.000Z"
}
```

**Save the warehouse `id`** - you'll need it for inventory operations!

### 3.2 List Warehouses

**Endpoint:** `GET /api/inventory/warehouses?page=1&limit=10`

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/inventory/warehouses?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Step 4: Inventory Management

### 4.1 View Inventory Items

**Endpoint:** `GET /api/inventory/items?warehouseId=<warehouse-id>&page=1&limit=10`

**Query Parameters:**
- `warehouseId` - Filter by warehouse (optional)
- `medicineId` - Filter by medicine (optional)
- `lowStock` - Show only low stock items (boolean, optional)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/inventory/items?warehouseId=20000000-0000-0000-0000-000000000001&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:**
```json
{
  "items": [
    {
      "id": "inventory-item-uuid",
      "medicine_id": "medicine-uuid",
      "warehouse_id": "warehouse-uuid",
      "quantity": 150,
      "reserved_qty": 0,
      "reorder_point": 20,
      "max_stock": 500,
      "cost_price": 10000,
      "selling_price": 15000,
      "batch_number": "BATCH-1234",
      "expiry_date": "2026-12-31",
      "medicine": {
        "id": "medicine-uuid",
        "trade_name": "Paracetamol",
        "strength": "500mg",
        "package_size": "10 tablets"
      },
      "warehouse": {
        "id": "warehouse-uuid",
        "name": "Main Store",
        "code": "WH-001"
      }
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10
}
```

### 4.2 Check Low Stock Items

**Endpoint:** `GET /api/inventory/low-stock`

**cURL Example:**
```bash
curl -X GET http://localhost:3000/api/inventory/low-stock \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:** List of items where `quantity <= reorder_point`

### 4.3 Add Stock (Stock Movement IN)

**Endpoint:** `POST /api/inventory/movements`

**Request:**
```json
{
  "inventory_item_id": "inventory-item-uuid",
  "warehouse_id": "20000000-0000-0000-0000-000000000001",
  "movement_type": "IN",
  "quantity": 100,
  "reference_type": "PURCHASE",
  "reference_id": "purchase-order-uuid",
  "notes": "Stock received from supplier"
}
```

**Movement Types:**
- `IN` - Stock received
- `OUT` - Stock sold/dispatched
- `ADJUSTMENT` - Stock correction
- `TRANSFER` - Stock moved between warehouses
- `RETURN` - Stock returned

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/inventory/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "inventory_item_id": "inventory-item-uuid",
    "warehouse_id": "20000000-0000-0000-0000-000000000001",
    "movement_type": "IN",
    "quantity": 100,
    "reference_type": "PURCHASE",
    "notes": "Stock received from supplier"
  }'
```

**Note:** This automatically updates the inventory item quantity!

### 4.4 Adjust Stock Quantity

**Endpoint:** `POST /api/inventory/items/:id/adjust`

**Request:**
```json
{
  "quantity": 50,
  "notes": "Physical count correction"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/inventory/items/INVENTORY_ITEM_ID/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "quantity": 50,
    "notes": "Physical count correction"
  }'
```

**Note:** Requires PHARMACIST or higher role. Automatically creates an ADJUSTMENT stock movement.

### 4.5 View Stock Movements

**Endpoint:** `GET /api/inventory/movements?warehouseId=<warehouse-id>&inventoryItemId=<item-id>&page=1&limit=10`

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/inventory/movements?warehouseId=20000000-0000-0000-0000-000000000001&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Step 5: Sales & POS Operations

### 5.1 Create a Sale (POS Transaction)

**Endpoint:** `POST /api/sales`

**Request:**
```json
{
  "warehouse_id": "20000000-0000-0000-0000-000000000001",
  "payment_method": "CASH",
  "items": [
    {
      "inventory_item_id": "inventory-item-uuid-1",
      "quantity": 2,
      "unit_price": 15000,
      "discount_percent": 10
    },
    {
      "inventory_item_id": "inventory-item-uuid-2",
      "quantity": 1,
      "unit_price": 25000
    }
  ],
  "notes": "Customer purchase"
}
```

**Payment Methods:**
- `CASH`
- `CARD`
- `TRANSFER`
- `MOBILE_PAYMENT`

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "warehouse_id": "20000000-0000-0000-0000-000000000001",
    "payment_method": "CASH",
    "items": [
      {
        "inventory_item_id": "inventory-item-uuid-1",
        "quantity": 2,
        "unit_price": 15000,
        "discount_percent": 10
      }
    ],
    "notes": "Customer purchase"
  }'
```

**Response:**
```json
{
  "id": "sale-uuid",
  "sale_number": "SALE-20250115-0001",
  "warehouse_id": "20000000-0000-0000-0000-000000000001",
  "user_id": "10000000-0000-0000-0000-000000000005",
  "status": "COMPLETED",
  "payment_method": "CASH",
  "total_amount": 52000,
  "discount_amount": 3000,
  "tax_amount": 0,
  "final_amount": 49000,
  "notes": "Customer purchase",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z",
  "items": [
    {
      "id": "sale-item-uuid",
      "sale_id": "sale-uuid",
      "inventory_item_id": "inventory-item-uuid-1",
      "medicine_id": "medicine-uuid",
      "quantity": 2,
      "unit_price": 15000,
      "discount_percent": 10,
      "discount_amount": 3000,
      "subtotal": 27000,
      "medicine": {
        "id": "medicine-uuid",
        "trade_name": "Paracetamol",
        "strength": "500mg",
        "package_size": "10 tablets"
      }
    }
  ]
}
```

**Important:** 
- Stock is automatically deducted from inventory when a sale is created
- Sale number is auto-generated (format: SALE-YYYYMMDD-XXXX)
- If insufficient stock, sale will be rejected with 400 error

### 5.2 View Sales List

**Endpoint:** `GET /api/sales?page=1&limit=10&warehouseId=<warehouse-id>&status=COMPLETED`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `warehouseId` - Filter by warehouse (optional)
- `status` - Filter by status: `PENDING`, `COMPLETED`, `CANCELLED`, `REFUNDED` (optional)
- `paymentMethod` - Filter by payment method: `CASH`, `CARD`, `TRANSFER`, `MOBILE_PAYMENT` (optional)
- `startDate` - Filter from date (ISO format, optional): `2025-01-01T00:00:00Z`
- `endDate` - Filter to date (ISO format, optional): `2025-01-31T23:59:59Z`

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/sales?page=1&limit=10&status=COMPLETED" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### 5.3 Get Sale Details

**Endpoint:** `GET /api/sales/:id`

**cURL Example:**
```bash
curl -X GET http://localhost:3000/api/sales/SALE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:** Full sale details with all items

### 5.4 Get Receipt

**Endpoint:** `GET /api/sales/:id/receipt`

**cURL Example:**
```bash
curl -X GET http://localhost:3000/api/sales/SALE_ID/receipt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:**
```json
{
  "sale_number": "SALE-20250115-0001",
  "sale_date": "2025-01-15T10:30:00.000Z",
  "tenant_name": "Toshkent Apteka",
  "warehouse_name": "Main Store",
  "warehouse_address": "Amir Temur ko'chasi 123, Toshkent",
  "cashier_name": "Farida Yusupova",
  "items": [
    {
      "medicine_name": "Paracetamol (500mg)",
      "quantity": 2,
      "unit_price": 15000,
      "subtotal": 30000,
      "discount_amount": 3000,
      "tax_amount": 0
    }
  ],
  "total_amount": 52000,
  "discount_amount": 3000,
  "tax_amount": 0,
  "final_amount": 49000,
  "payment_method": "CASH",
  "notes": "Customer purchase"
}
```

### 5.5 Cancel Sale (Manager+ only)

**Endpoint:** `POST /api/sales/:id/cancel`

**Note:** 
- Only MANAGER, PHARMACY_ADMIN, or SUPER_ADMIN can cancel sales
- Sales can only be cancelled on the same day
- Cancelling automatically restores stock to inventory

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/sales/SALE_ID/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:** Updated sale with status = CANCELLED

### 5.6 View Sales Statistics

**Endpoint:** `GET /api/sales/stats/overview?warehouseId=<warehouse-id>&startDate=2025-01-01&endDate=2025-01-31`

**Query Parameters:**
- `warehouseId` - Filter by warehouse (optional)
- `startDate` - Filter from date (ISO format, optional)
- `endDate` - Filter to date (ISO format, optional)

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/sales/stats/overview?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Response:**
```json
{
  "total_sales": 150,
  "total_revenue": 12500000,
  "average_transaction": 83333.33,
  "sales_by_payment_method": {
    "CASH": 80,
    "CARD": 45,
    "MOBILE_PAYMENT": 20,
    "TRANSFER": 5
  }
}
```

---

## Step 6: Medicine Catalog Operations

### 6.1 Search Medicines

**Endpoint:** `POST /api/search`

**Request:**
```json
{
  "query": "paracetamol",
  "limit": 20
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "paracetamol",
    "limit": 20
  }'
```

**Response:** Array of medicines matching the search query (fuzzy search)

### 6.2 Search by Active Ingredient

**Endpoint:** `GET /api/search/by-ingredient?ingredient=azithromycin&limit=20`

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/search/by-ingredient?ingredient=azithromycin&limit=20"
```

### 6.3 List Medicines

**Endpoint:** `GET /api/medicines?page=1&limit=10`

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/medicines?page=1&limit=10"
```

### 6.4 Get Medicine Details

**Endpoint:** `GET /api/medicines/:id`

**cURL Example:**
```bash
curl -X GET http://localhost:3000/api/medicines/MEDICINE_ID
```

**Response:** Full medicine details with active ingredients, manufacturer, etc.

---

## Step 7: Complete Workflow Example

Here's a complete workflow from login to making a sale:

### Step 7.1: Login and Get Token

```bash
# Login and extract token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier1@toshkent.uz","password":"password123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"
```

### Step 7.2: View Warehouses

```bash
curl -X GET "http://localhost:3000/api/inventory/warehouses" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 7.3: Check Available Inventory

```bash
curl -X GET "http://localhost:3000/api/inventory/items?warehouseId=20000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Note the `inventory_item_id` from the response for the next step.**

### Step 7.4: Create a Sale

```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "warehouse_id": "20000000-0000-0000-0000-000000000001",
    "payment_method": "CASH",
    "items": [
      {
        "inventory_item_id": "INVENTORY_ITEM_ID_FROM_STEP_7.3",
        "quantity": 2,
        "unit_price": 15000
      }
    ]
  }' | jq
```

**Note the `sale_id` from the response for the next step.**

### Step 7.5: Get Receipt

```bash
curl -X GET http://localhost:3000/api/sales/SALE_ID/receipt \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 7.6: View Today's Sales

```bash
TODAY=$(date +%Y-%m-%d)
curl -X GET "http://localhost:3000/api/sales?startDate=${TODAY}T00:00:00Z&endDate=${TODAY}T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 7.7: View Sales Statistics

```bash
curl -X GET "http://localhost:3000/api/sales/stats/overview" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## API Endpoint Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Inventory Management
- `POST /api/inventory/warehouses` - Create warehouse (PHARMACY_ADMIN+)
- `GET /api/inventory/warehouses` - List warehouses
- `GET /api/inventory/warehouses/:id` - Get warehouse details
- `GET /api/inventory/items` - List inventory items
- `GET /api/inventory/items/:id` - Get inventory item details
- `POST /api/inventory/items/:id/adjust` - Adjust stock (PHARMACIST+)
- `POST /api/inventory/movements` - Record stock movement (PHARMACIST+)
- `GET /api/inventory/movements` - List stock movements
- `GET /api/inventory/low-stock` - Get low stock items

### Sales & POS
- `POST /api/sales` - Create sale (all authenticated users)
- `GET /api/sales` - List sales (with filters)
- `GET /api/sales/:id` - Get sale details
- `POST /api/sales/:id/cancel` - Cancel sale (MANAGER+)
- `GET /api/sales/:id/receipt` - Get receipt
- `GET /api/sales/stats/overview` - Sales statistics

### Medicine Catalog
- `GET /api/medicines` - List medicines
- `GET /api/medicines/:id` - Get medicine details
- `POST /api/search` - Search medicines
- `GET /api/search/by-ingredient?ingredient=...` - Search by ingredient

---

## Authentication Header

All authenticated endpoints require the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/api/inventory/warehouses
```

---

## Role Permissions

| Role | Inventory View | Inventory Adjust | Sales Create | Sales Cancel | Warehouse Create |
|------|---------------|------------------|--------------|-------------|------------------|
| CASHIER | ✅ | ❌ | ✅ | ❌ | ❌ |
| PHARMACIST | ✅ | ✅ | ✅ | ❌ | ❌ |
| MANAGER | ✅ | ✅ | ✅ | ✅ | ✅ |
| PHARMACY_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solution:** Check your JWT token is valid and not expired

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```
**Solution:** Your role doesn't have permission for this action

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": [
    "quantity must be a positive number",
    "warehouse_id must be a UUID"
  ],
  "error": "Bad Request"
}
```
**Solution:** Check your request body matches the required format

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Sale with ID xxx not found"
}
```
**Solution:** Verify the resource ID exists and belongs to your tenant

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "User with this email already exists"
}
```
**Solution:** Resource already exists (e.g., duplicate email)

---

## Tips & Best Practices

1. **Always use HTTPS in production** - Never send JWT tokens over unencrypted connections
2. **Store tokens securely** - Don't commit tokens to version control or log them
3. **Refresh tokens** - Re-login when token expires (default: 24 hours)
4. **Handle errors gracefully** - Always check response status codes
5. **Use Swagger UI** - Interactive API testing at `http://localhost:3000/api/docs`
6. **Pagination** - Always use pagination for list endpoints to avoid large responses
7. **Filter by date** - Use date filters for sales/inventory reports to improve performance
8. **Validate stock before sale** - Check inventory items have sufficient stock
9. **Use proper roles** - Assign appropriate roles to users based on their responsibilities
10. **Monitor low stock** - Regularly check low stock items to avoid stockouts

---

## Testing with Swagger UI

1. Open `http://localhost:3000/api/docs` in your browser
2. Click the **"Authorize"** button (top right)
3. Enter your JWT token: `Bearer <your-token>` (or just the token)
4. Click **"Authorize"** to authenticate
5. Now you can test all endpoints directly from the browser!
6. Click **"Try it out"** on any endpoint to test it

---

## Quick Start Script

Save this as `quick-start.sh`:

```bash
#!/bin/bash

# Colors
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Pharmacy ERP Quick Start ===${NC}\n"

# 1. Login
echo "1. Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier1@toshkent.uz","password":"password123"}' \
  | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:50}...\n"

# 2. List warehouses
echo "2. Fetching warehouses..."
curl -s -X GET "http://localhost:3000/api/inventory/warehouses" \
  -H "Authorization: Bearer $TOKEN" | jq '.warehouses[] | {id, name, code}'

# 3. List inventory
echo -e "\n3. Fetching inventory items..."
curl -s -X GET "http://localhost:3000/api/inventory/items?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.items[] | {id, medicine: .medicine.trade_name, quantity, selling_price}'

# 4. Sales stats
echo -e "\n4. Sales statistics..."
curl -s -X GET "http://localhost:3000/api/sales/stats/overview" \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\n${GREEN}✅ Quick start complete!${NC}"
```

Make it executable:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

---

## Common Use Cases

### Use Case 1: Daily Sales Report

```bash
# Get today's sales
TODAY=$(date +%Y-%m-%d)
curl -X GET "http://localhost:3000/api/sales?startDate=${TODAY}T00:00:00Z&endDate=${TODAY}T23:59:59Z&status=COMPLETED" \
  -H "Authorization: Bearer $TOKEN" | jq

# Get today's statistics
curl -X GET "http://localhost:3000/api/sales/stats/overview?startDate=${TODAY}T00:00:00Z&endDate=${TODAY}T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Use Case 2: Check Low Stock and Reorder

```bash
# Get low stock items
curl -X GET "http://localhost:3000/api/inventory/low-stock" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {medicine: .medicine.trade_name, quantity, reorder_point, warehouse: .warehouse.name}'
```

### Use Case 3: Stock Movement History

```bash
# Get recent stock movements
curl -X GET "http://localhost:3000/api/inventory/movements?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.movements[] | {type: .movement_type, quantity, date: .created_at, notes}'
```

### Use Case 4: Find Medicine Alternatives

```bash
# Search for medicine
MEDICINE_ID=$(curl -s -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"paracetamol","limit":1}' | jq -r '.[0].id')

# Get alternatives
curl -X GET "http://localhost:3000/api/medicines/$MEDICINE_ID/alternatives" | jq
```

---

## Next Steps

1. **Set up your first tenant** - Use mock data or create via database
2. **Create users** - Register users with appropriate roles via API
3. **Add warehouses** - Create storage locations
4. **Import medicines** - Use the import endpoint or seed data
5. **Add inventory** - Create inventory items and stock movements
6. **Start selling** - Create your first sale!

For detailed business logic flows, see `business_flow.md`.

---

## Troubleshooting

### Issue: "Unauthorized" error
- Check if JWT token is included in Authorization header
- Verify token hasn't expired (default: 24 hours)
- Re-login to get a new token

### Issue: "Forbidden" error
- Check your user role has permission for the operation
- Verify you're accessing resources from your tenant

### Issue: "Insufficient stock" when creating sale
- Check inventory item quantity
- Verify warehouse_id is correct
- Check if stock is reserved (reserved_qty)

### Issue: "Sale cannot be cancelled"
- Only MANAGER+ can cancel sales
- Sales can only be cancelled on the same day
- Check if sale status is already CANCELLED or REFUNDED

### Issue: Database connection errors
- Verify DATABASE_URL in .env is correct
- Check PostgreSQL is running
- Ensure database exists and schema is applied

---

## Support

- **Swagger Documentation:** `http://localhost:3000/api/docs`
- **Business Flow:** See `business_flow.md` for detailed workflows
- **Database Schema:** See `base.sql` for schema structure

