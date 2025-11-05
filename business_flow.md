# Pharmacy ERP - Business Logic Flow Documentation

## Overview
This document describes the business logic flows for the multi-tenant Pharmacy ERP system, including authentication, inventory management, and stock operations.

---

## 1. Authentication & Authorization Flow

### 1.1 User Registration Flow

```
START
  ↓
User submits registration form (email, password, optional: name, role, tenant_id)
  ↓
Validate input data
  ↓
Check if email already exists
  ├─ YES → Return 409 Conflict Error
  └─ NO → Continue
  ↓
Validate tenant_id (if provided)
  ├─ Tenant exists & active → Continue
  └─ Tenant not found/inactive → Return 409 Conflict Error
  ↓
Hash password using bcrypt (10 rounds by default)
  ↓
Create user record with:
  - email (unique)
  - password_hash
  - first_name, last_name (optional)
  - role (default: CASHIER)
  - tenant_id (if provided)
  - is_active = true
  ↓
Generate JWT token with payload:
  - sub: user.id
  - email: user.email
  - role: user.role
  - tenantId: user.tenant_id
  ↓
Return AuthResponseDto:
  - access_token (JWT)
  - token_type: "Bearer"
  - user: { id, email, first_name, last_name, role, tenant_id }
END
```

### 1.2 User Login Flow

```
START
  ↓
User submits login credentials (email, password)
  ↓
Find user by email
  ├─ Not found → Return 401 Unauthorized
  └─ Found → Continue
  ↓
Check if user is active
  ├─ Inactive → Return 401 Unauthorized
  └─ Active → Continue
  ↓
Compare password with stored hash using bcrypt
  ├─ Mismatch → Return 401 Unauthorized
  └─ Match → Continue
  ↓
Generate JWT token with payload:
  - sub: user.id
  - email: user.email
  - role: user.role
  - tenantId: user.tenant_id
  ↓
Return AuthResponseDto with token and user info
END
```

### 1.3 JWT Token Validation Flow

```
Request with Authorization: Bearer <token>
  ↓
JWT Strategy extracts token from header
  ↓
Verify token signature using JWT_SECRET
  ├─ Invalid → Return 401 Unauthorized
  └─ Valid → Continue
  ↓
Extract payload (sub, email, role, tenantId)
  ↓
Query database for user by ID (sub)
  ├─ Not found → Return 401 Unauthorized
  └─ Found → Continue
  ↓
Check if user is active
  ├─ Inactive → Return 401 Unauthorized
  └─ Active → Continue
  ↓
Attach user object to request:
  - sub: user.id
  - email: user.email
  - role: user.role
  - tenantId: user.tenant_id
  ↓
Continue to next middleware/controller
END
```

### 1.4 Role-Based Access Control Flow

```
Request arrives at protected endpoint
  ↓
JwtAuthGuard validates token (see 1.3)
  ↓
RolesGuard checks if endpoint requires specific roles
  ├─ No roles required → Allow access
  └─ Roles required → Continue
  ↓
Extract required roles from @Roles() decorator
  ↓
Get user role from request.user
  ↓
Check if user is SUPER_ADMIN
  ├─ YES → Allow access (super admin bypass)
  └─ NO → Continue
  ↓
Check if user.role matches any required role
  ├─ Match → Allow access
  └─ No match → Return 403 Forbidden
  ↓
Continue to controller handler
END
```

---

## 2. Multi-Tenancy Flow

### 2.1 Tenant Isolation Flow

```
Request with JWT token
  ↓
JWT validated (extracts tenantId from token)
  ↓
TenantInterceptor extracts tenantId from request.user
  ↓
Attach tenantId to request object
  ↓
Service method receives tenantId parameter
  ↓
All database queries automatically filtered by tenant_id:
  - Warehouses: WHERE tenant_id = currentTenantId
  - Inventory Items: WHERE warehouse.tenant_id = currentTenantId
  - Stock Movements: WHERE warehouse.tenant_id = currentTenantId
  ↓
Results automatically scoped to tenant
END
```

### 2.2 Tenant Context Flow

```
User Login
  ↓
JWT token includes tenantId
  ↓
Every authenticated request includes tenantId in JWT payload
  ↓
@CurrentTenant() decorator extracts tenantId from request
  ↓
Service methods receive tenantId as parameter
  ↓
Database queries filtered by tenant_id
  ↓
User can only access data belonging to their tenant
END
```

---

## 3. Warehouse Management Flow

### 3.1 Create Warehouse Flow

```
START
  ↓
User with PHARMACY_ADMIN, MANAGER, or SUPER_ADMIN role
  ↓
Submit CreateWarehouseDto:
  - name (required)
  - code (optional)
  - address (optional)
  ↓
Extract tenantId from JWT token
  ↓
Validate input data
  ↓
Create warehouse record:
  - name
  - code (if provided)
  - address (if provided)
  - tenant_id = currentTenantId
  - is_active = true
  ↓
Return WarehouseResponseDto
END
```

### 3.2 List Warehouses Flow

```
START
  ↓
User authenticated with any role
  ↓
Extract tenantId from JWT token
  ↓
Query warehouses WHERE:
  - tenant_id = currentTenantId
  - is_active = true
  ↓
Apply pagination (page, limit)
  ↓
Order by created_at DESC
  ↓
Return paginated list of warehouses
END
```

---

## 4. Inventory Item Management Flow

### 4.1 List Inventory Items Flow

```
START
  ↓
User authenticated with any role
  ↓
Extract tenantId from JWT token
  ↓
Build query filters:
  - warehouse.tenant_id = currentTenantId (always)
  - warehouse_id (optional filter)
  - medicine_id (optional filter)
  - lowStock filter (optional)
  ↓
Apply lowStock filter if requested:
  WHERE quantity <= reorder_point
  ↓
Query inventory_items with:
  - Include medicine details
  - Include warehouse details
  ↓
Apply pagination
  ↓
Order by updated_at DESC
  ↓
Return paginated list of inventory items
END
```

### 4.2 Get Inventory Item Details Flow

```
START
  ↓
User authenticated with any role
  ↓
Extract tenantId from JWT token
  ↓
Find inventory item by ID
  WHERE:
  - id = requestedId
  - warehouse.tenant_id = currentTenantId
  ↓
Item found?
  ├─ NO → Return 404 Not Found
  └─ YES → Continue
  ↓
Include related data:
  - medicine (id, trade_name, strength, package_size)
  - warehouse (id, name, code)
  ↓
Return InventoryItemResponseDto
END
```

---

## 5. Stock Movement Flow

### 5.1 Record Stock Movement Flow

```
START
  ↓
User with PHARMACIST, PHARMACY_ADMIN, MANAGER, or SUPER_ADMIN role
  ↓
Submit CreateStockMovementDto:
  - inventory_item_id
  - warehouse_id
  - movement_type (IN, OUT, ADJUSTMENT, TRANSFER, RETURN)
  - quantity (positive integer)
  - reference_type (optional)
  - reference_id (optional)
  - notes (optional)
  ↓
Extract tenantId and userId from JWT token
  ↓
Validate warehouse belongs to tenant
  WHERE warehouse.id = warehouse_id AND tenant_id = currentTenantId
  ├─ Not found → Return 404 Not Found
  └─ Found → Continue
  ↓
Validate inventory item exists and belongs to warehouse
  WHERE id = inventory_item_id AND warehouse_id = warehouse_id
  ├─ Not found → Return 404 Not Found
  └─ Found → Continue
  ↓
Calculate new quantity based on movement_type:
  - IN: quantity += movement.quantity
  - OUT: quantity -= movement.quantity
  - ADJUSTMENT: quantity = movement.quantity
  - TRANSFER: (handled separately, requires source and destination)
  - RETURN: quantity += movement.quantity
  ↓
Check for negative stock (OUT movements)
  ├─ New quantity < 0 → Return 400 Bad Request "Insufficient stock"
  └─ Valid → Continue
  ↓
Begin database transaction
  ↓
Update inventory_item.quantity = newQuantity
  ↓
Create stock_movement record:
  - inventory_item_id
  - warehouse_id
  - movement_type
  - quantity
  - reference_type
  - reference_id
  - notes
  - created_by = userId
  - created_at = now()
  ↓
Commit transaction
  ↓
Return StockMovementResponseDto
END
```

### 5.2 Stock Adjustment Flow

```
START
  ↓
User with PHARMACIST, PHARMACY_ADMIN, MANAGER, or SUPER_ADMIN role
  ↓
Submit AdjustStockDto:
  - quantity (new quantity, >= 0)
  - notes (optional)
  ↓
Extract tenantId and userId from JWT token
  ↓
Find inventory item by ID (with tenant validation)
  ├─ Not found → Return 404 Not Found
  └─ Found → Continue
  ↓
Calculate difference = newQuantity - oldQuantity
  ├─ Difference = 0 → Return 400 Bad Request
  └─ Difference != 0 → Continue
  ↓
Begin database transaction
  ↓
Update inventory_item.quantity = newQuantity
  ↓
Create stock_movement record:
  - movement_type = ADJUSTMENT
  - quantity = abs(difference)
  - notes = provided notes or auto-generated
  - created_by = userId
  ↓
Commit transaction
  ↓
Return updated InventoryItemResponseDto
END
```

### 5.3 List Stock Movements Flow

```
START
  ↓
User authenticated with any role
  ↓
Extract tenantId from JWT token
  ↓
Build query filters:
  - warehouse.tenant_id = currentTenantId (always)
  - warehouse_id (optional filter)
  - inventory_item_id (optional filter)
  ↓
Query stock_movements with:
  - Include inventory_item with medicine details
  - Include user (created_by) details
  ↓
Apply pagination
  ↓
Order by created_at DESC
  ↓
Return paginated list of stock movements
END
```

---

## 6. Low Stock Alert Flow

### 6.1 Get Low Stock Items Flow

```
START
  ↓
User authenticated with any role
  ↓
Extract tenantId from JWT token
  ↓
Get all warehouses for tenant
  WHERE tenant_id = currentTenantId
  ↓
Get all inventory items for tenant's warehouses
  WHERE warehouse_id IN (tenant_warehouse_ids)
  ↓
Filter items where:
  quantity <= reorder_point
  (if reorder_point is null, treat as 0)
  ↓
Sort results:
  - Primary: quantity ASC (lowest first)
  - Secondary: reorder_point DESC
  ↓
Include related data:
  - medicine details
  - warehouse details
  ↓
Return list of low stock items
END
```

---

## 7. Permission Matrix

### 7.1 Role Permissions

| Feature | SUPER_ADMIN | PHARMACY_ADMIN | MANAGER | PHARMACIST | CASHIER |
|---------|-------------|----------------|---------|------------|---------|
| Create Warehouse | ✅ | ✅ | ✅ | ❌ | ❌ |
| List Warehouses | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adjust Stock | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record Stock Movement | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Stock Movements | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Low Stock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register User | ✅ | ✅ | ❌ | ❌ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |

### 7.2 Data Access Rules

- All users can only access data from their own tenant
- SUPER_ADMIN can access all tenants (future enhancement)
- Warehouse operations require tenant ownership validation
- Stock movements require tenant ownership validation
- Inventory items inherit tenant from warehouse

---

## 8. Error Handling Flow

### 8.1 Authentication Errors

```
Invalid credentials (401)
  ↓
User not found or inactive
  ↓
Return 401 Unauthorized
  ↓
Client receives error message
END
```

### 8.2 Authorization Errors

```
User lacks required role
  ↓
RolesGuard checks permissions
  ↓
Return 403 Forbidden
  ↓
Client receives error message
END
```

### 8.3 Validation Errors

```
Invalid input data
  ↓
class-validator validates DTO
  ↓
Return 400 Bad Request with validation errors
  ↓
Client receives detailed error messages
END
```

### 8.4 Business Logic Errors

```
Insufficient stock
  ↓
Service validates stock availability
  ↓
Return 400 Bad Request "Insufficient stock"
  ↓
Client receives error message
END
```

### 8.5 Not Found Errors

```
Resource not found
  ↓
Service queries database
  ↓
Resource doesn't exist or not accessible
  ↓
Return 404 Not Found
  ↓
Client receives error message
END
```

---

## 9. Data Flow Examples

### 9.1 Complete Stock Receipt Flow

```
1. User (PHARMACIST) logs in
   → Receives JWT token with tenantId

2. User creates warehouse (if needed)
   POST /api/inventory/warehouses
   → Warehouse created with tenant_id

3. User records stock receipt
   POST /api/inventory/movements
   Body: {
     inventory_item_id: "xxx",
     warehouse_id: "yyy",
     movement_type: "IN",
     quantity: 100,
     reference_type: "PURCHASE",
     reference_id: "purchase_order_123",
     notes: "Received from supplier"
   }
   → Inventory item quantity += 100
   → Stock movement record created

4. System logs:
   - User who created movement
   - Timestamp
   - Reference information
END
```

### 9.2 Stock Sale Flow

```
1. User (CASHIER) creates sale
   POST /api/sales
   Body: {
     warehouse_id: "xxx",
     payment_method: "CASH",
     items: [
       {
         inventory_item_id: "yyy",
         quantity: 5,
         unit_price: 15000,
         discount_percent: 10
       }
     ]
   }
   → Sale validation begins

2. System validates warehouse belongs to tenant
   → If not found → Return 404 Not Found

3. For each item:
   a. Validate inventory item exists in warehouse
   b. Check available stock (quantity - reserved_qty)
   c. If insufficient stock → Return 400 Bad Request
   d. Get unit price (from item or inventory_item.selling_price)
   e. Calculate subtotal with discount and tax

4. Calculate sale totals:
   - total_amount = sum of (quantity * unit_price)
   - discount_amount = sum of item discounts
   - tax_amount = sum of item taxes
   - final_amount = total_amount - discount_amount + tax_amount

5. Generate unique sale number (SALE-YYYYMMDD-XXXX)

6. BEGIN TRANSACTION

7. Create sale record with status COMPLETED

8. For each item:
   a. Create sale_item record
   b. Update inventory_item.quantity (decrement)
   c. Create stock_movement (OUT, reference_type='SALE')

9. COMMIT TRANSACTION

10. Return SaleResponseDto with all details
END
```

---

## 10. Database Transaction Flow

### 10.1 Stock Movement Transaction

```
BEGIN TRANSACTION
  ↓
Lock inventory_item row
  ↓
Validate current quantity
  ↓
Calculate new quantity
  ↓
Update inventory_item.quantity
  ↓
Create stock_movement record
  ↓
COMMIT TRANSACTION
  ↓
Return success response
END

If error occurs:
  ↓
ROLLBACK TRANSACTION
  ↓
Return error response
END
```

---

## 11. Audit Trail Flow

### 11.1 Stock Movement Audit

```
Every stock movement creates audit record:
  - Who: created_by (user_id)
  - What: movement_type, quantity
  - When: created_at (timestamp)
  - Where: warehouse_id
  - Why: notes, reference_type, reference_id
  ↓
Audit trail is immutable
  ↓
Can be queried for:
  - Warehouse history
  - Item history
  - User activity
  - Date range reports
END
```

---

## 12. Sales & POS Flows

### 12.1 Create Sale Flow (POS Transaction)

```
START
  ↓
User (CASHIER) authenticated with JWT token
  ↓
Submit CreateSaleDto:
  - warehouse_id
  - payment_method (CASH, CARD, TRANSFER, MOBILE_PAYMENT)
  - items[] (at least 1 item required)
  - notes (optional)
  ↓
Extract tenantId and userId from JWT token
  ↓
Validate warehouse belongs to tenant
  ├─ Not found → Return 404 Not Found
  └─ Found → Continue
  ↓
For each item in items:
  ├─ Validate inventory_item exists in warehouse
  ├─ Check available stock (quantity - reserved_qty)
  ├─ If insufficient → Return 400 Bad Request
  ├─ Get unit_price (from item or inventory_item.selling_price)
  └─ Calculate subtotal with discount and tax
  ↓
Calculate sale totals:
  - total_amount = sum(quantity * unit_price)
  - discount_amount = sum(item discounts)
  - tax_amount = sum(item taxes)
  - final_amount = total_amount - discount_amount + tax_amount
  ↓
Generate unique sale_number (SALE-YYYYMMDD-XXXX)
  ↓
BEGIN TRANSACTION
  ↓
Create sale record:
  - sale_number
  - warehouse_id
  - user_id (cashier)
  - status = COMPLETED
  - payment_method
  - total_amount, discount_amount, tax_amount, final_amount
  - notes
  - tenant_id
  ↓
For each item:
  ├─ Create sale_item record
  ├─ Update inventory_item.quantity (decrement by quantity)
  └─ Create stock_movement (OUT, reference_type='SALE')
  ↓
COMMIT TRANSACTION
  ↓
Return SaleResponseDto with items and details
END
```

### 12.2 Sale Cancellation Flow

```
START
  ↓
User (MANAGER or higher role) authenticated
  ↓
POST /api/sales/:id/cancel
  ↓
Extract tenantId and userId from JWT token
  ↓
Find sale by ID and tenantId
  ├─ Not found → Return 404 Not Found
  └─ Found → Continue
  ↓
Check sale status
  ├─ Already CANCELLED → Return 400 Bad Request
  ├─ REFUNDED → Return 400 Bad Request
  └─ COMPLETED → Continue
  ↓
Check if sale is from same day
  ├─ No → Return 403 Forbidden (can only cancel same day)
  └─ Yes → Continue
  ↓
BEGIN TRANSACTION
  ↓
Update sale status to CANCELLED
  ↓
For each sale_item:
  ├─ Update inventory_item.quantity (increment by quantity)
  └─ Create stock_movement (RETURN, reference_type='SALE_CANCELLATION')
  ↓
COMMIT TRANSACTION
  ↓
Return updated SaleResponseDto
END
```

### 12.3 Receipt Generation Flow

```
START
  ↓
User authenticated with any role
  ↓
GET /api/sales/:id/receipt
  ↓
Extract tenantId from JWT token
  ↓
Find sale by ID and tenantId with relations:
  - sale_items (with medicine details)
  - warehouse
  - user (cashier)
  - tenant
  ↓
Sale not found?
  ├─ YES → Return Error
  └─ NO → Continue
  ↓
Build receipt data:
  - sale_number
  - sale_date
  - tenant_name
  - warehouse_name and address
  - cashier_name (from user first_name/last_name or email)
  - items[] (medicine_name, quantity, unit_price, subtotal, discounts, taxes)
  - total_amount, discount_amount, tax_amount, final_amount
  - payment_method
  - notes
  ↓
Return ReceiptDto
END
```

### 12.4 Sales Statistics Flow

```
START
  ↓
User authenticated with any role
  ↓
GET /api/sales/stats/overview
  ↓
Extract tenantId from JWT token
  ↓
Build query filters:
  - tenant_id = currentTenantId (always)
  - status = COMPLETED (always)
  - warehouse_id (optional filter)
  - created_at date range (optional)
  ↓
Query database:
  - Count total sales
  - Sum final_amount (total revenue)
  - Get all sales for payment method breakdown
  ↓
Calculate statistics:
  - total_sales = count
  - total_revenue = sum of final_amount
  - average_transaction = total_revenue / total_sales
  - sales_by_payment_method = grouped count by payment_method
  ↓
Return statistics object
END
```

### 12.5 Sale Number Generation Flow

```
START
  ↓
Get current date (YYYYMMDD format)
  ↓
Build prefix: "SALE-YYYYMMDD"
  ↓
Query sales table:
  WHERE tenant_id = currentTenantId
    AND created_at >= start_of_today
    AND created_at <= end_of_today
    AND sale_number LIKE 'SALE-YYYYMMDD-%'
  ↓
Count existing sales for today
  ↓
Generate sequence number:
  sequence = (count + 1) padded to 4 digits (0001, 0002, etc.)
  ↓
Return: "SALE-YYYYMMDD-XXXX"
END
```

### 12.6 Sale Item Calculation Flow

```
START
  ↓
Input: quantity, unit_price, discount_percent, discount_amount, tax_percent
  ↓
Calculate base_amount = quantity * unit_price
  ↓
Calculate discount:
  ├─ If discount_amount provided → use discount_amount
  ├─ Else if discount_percent provided → discount = (base_amount * discount_percent) / 100
  └─ Else → discount = 0
  ↓
Calculate amount_after_discount = base_amount - discount
  ↓
Calculate tax:
  ├─ If tax_percent provided → tax = (amount_after_discount * tax_percent) / 100
  └─ Else → tax = 0
  ↓
Calculate subtotal = amount_after_discount + tax
  ↓
Round all amounts to 2 decimal places
  ↓
Return: { subtotal, discountAmount, taxAmount }
END
```

---

## Notes

1. **Tenant Isolation**: All queries automatically filter by tenant_id to ensure data isolation
2. **Role-Based Access**: Endpoints protected with appropriate role guards
3. **Audit Trail**: All stock movements are logged with user, timestamp, and reason
4. **Transaction Safety**: Stock operations use database transactions to ensure data consistency
5. **Validation**: Input validation at DTO level using class-validator
6. **Error Handling**: Consistent error responses across all endpoints

---

## 13. Permission Matrix (Updated)

### 13.1 Role Permissions

| Feature | SUPER_ADMIN | PHARMACY_ADMIN | MANAGER | PHARMACIST | CASHIER |
|---------|-------------|----------------|---------|------------|---------|
| Create Warehouse | ✅ | ✅ | ✅ | ❌ | ❌ |
| List Warehouses | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adjust Stock | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record Stock Movement | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Stock Movements | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Low Stock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Sale | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Sales | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cancel Sale | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Receipt | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Sales Statistics | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register User | ✅ | ✅ | ❌ | ❌ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |

### 13.2 Data Access Rules

- All users can only access data from their own tenant
- SUPER_ADMIN can access all tenants (future enhancement)
- Warehouse operations require tenant ownership validation
- Stock movements require tenant ownership validation
- Inventory items inherit tenant from warehouse
- Sales inherit tenant from warehouse
- Sale cancellation restricted to same day and requires MANAGER+ role

---

## Future Enhancements

1. **Stock Transfer**: Transfer stock between warehouses
2. **Batch Tracking**: Enhanced batch number and expiry date management
3. **Reserved Stock**: Handle reserved quantities for pending orders
4. **Automatic Reordering**: Trigger purchase orders when stock reaches reorder point
5. **Multi-warehouse Support**: Support for transfers between warehouses
6. **Reporting**: Advanced inventory reports and analytics
7. **Sales Returns/Refunds**: Handle product returns and refunds
8. **Purchase Integration**: Automatic stock addition on purchases
9. **Barcode Scanning**: POS barcode scanning for faster checkout
10. **Receipt Printing**: Hardware integration for receipt printing
11. **Sales Reports**: Advanced sales analytics and reporting
12. **Discounts and Promotions**: Automated discount management

