# Medicine Alternative Finder API

A NestJS-based API for finding cheaper medicine alternatives in Uzbekistan based on active ingredients, similar to TrueMeds India.

## Features

- **Medicine Search**: Fuzzy search across trade names and active ingredients
- **Alternative Finder**: Find cheaper alternatives based on active ingredients, dosage form, and strength
- **Excel Import**: Import medicine data from Excel files
- **Admin Panel**: Manage prices and medicine information
- **Comprehensive API**: Full CRUD operations with Swagger documentation

## Tech Stack

- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Search**: PostgreSQL trigram extension for fuzzy search
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator and class-transformer

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd dorixona
   ```

2. **Install dependencies**

```bash
   npm install
```

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/medicine_db"
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up the database**

   ```bash
   # Create the database
   createdb medicine_db

   # Run the SQL schema (from base.sql)
   psql -d medicine_db -f base.sql
   ```

5. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

## Running the Application

1. **Development mode**

   ```bash
   npm run start:dev
   ```

2. **Production mode**
   ```bash
   npm run build
   npm run start:prod
   ```

The API will be available at `http://localhost:3000`

## API Documentation

Once the application is running, visit `http://localhost:3000/api/docs` for interactive Swagger documentation.

## Key Endpoints

### Search & Discovery

- `POST /api/search` - Search medicines by name or ingredient
- `GET /api/search/by-ingredient?ingredient=azithromycin` - Search by active ingredient
- `GET /api/medicines/:id/alternatives` - Find cheaper alternatives
- `GET /api/medicines/:id/cheapest-alternatives` - Find cheapest alternatives

### Medicine Management

- `GET /api/medicines` - List all medicines (paginated)
- `GET /api/medicines/:id` - Get medicine details
- `GET /api/medicines/by-ingredient/:ingredientId` - Medicines by ingredient

### Reference Data

- `GET /api/active-ingredients` - List active ingredients
- `GET /api/manufacturers` - List manufacturers
- `GET /api/manufacturers/local` - Local manufacturers only

### Admin Operations

- `POST /api/admin/import` - Import medicines from Excel files
- `PUT /api/admin/medicines/:id/price` - Update medicine price
- `PUT /api/admin/medicines/prices/bulk` - Bulk update prices
- `GET /api/admin/statistics` - Import statistics

## Data Import

The application can import medicine data from Excel files in the `public/` directory. The expected format:

| Column              | Description            | Example       |
| ------------------- | ---------------------- | ------------- |
| International Name  | Active ingredient name | Azithromycin  |
| Trade Name          | Brand name             | Sumamed       |
| Manufacturer        | Company name           | Teva          |
| Dosage Form         | Form type              | Tablet        |
| Strength            | Dosage strength        | 500mg         |
| Package Size        | Package description    | 3 tablets     |
| Registration Number | Registration ID        | DV/X 12345/01 |

To import data:

```bash
curl -X POST http://localhost:3000/api/admin/import
```

## Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **Active Ingredients**: Generic/international names with therapeutic classifications
- **Medicines**: Trade names, strengths, packaging, pricing
- **Manufacturers**: Company information with reliability ratings
- **Dosage Forms**: Tablet, capsule, syrup, injection, etc.
- **Relationships**: Many-to-many for combination drugs
- **Indexes**: Optimized for fuzzy search and performance

## Medical Safety Features

- **Narrow Therapeutic Index**: Flags medicines where generics may not be interchangeable
- **Dosage Form Matching**: Ensures compatible forms (tablet ≠ syrup)
- **Strength Matching**: Compares dosages with tolerance
- **Medical Disclaimers**: Includes consultation warnings
- **Prescription Requirements**: Tracks prescription-only medicines

## Development

### Project Structure

```
src/
├── config/           # Database and configuration
├── common/           # Shared utilities and DTOs
├── import/           # Excel import functionality
├── search/           # Medicine search
├── alternatives/     # Alternative finder
├── medicines/        # Medicine CRUD
├── active-ingredients/ # Active ingredient management
├── manufacturers/    # Manufacturer management
└── admin/           # Admin operations
```

### Key Utilities

- **StrengthParser**: Parses medicine strengths (500mg → value: 500, unit: mg)
- **Fuzzy Search**: PostgreSQL trigram similarity for flexible matching
- **Validation**: Comprehensive input validation with class-validator

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please open a GitHub issue or contact the development team.

---

**Important Medical Disclaimer**: This application is for informational purposes only. Always consult with a healthcare professional before making any changes to your medication regimen.
# dorixona
