import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { StrengthParser } from '../common/utils/strength-parser.util';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';

export interface ImportResult {
  totalProcessed: number;
  created: number;
  skipped: number;
  errors: string[];
}

export interface ExcelRow {
  internationalName: string;
  tradeName: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packageSize: string;
  registrationNumber: string;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private prisma: PrismaService) { }

  async importMedicines(): Promise<ImportResult> {
    this.logger.log('Starting medicine import process...');

    const result: ImportResult = {
      totalProcessed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get all Excel files from public directory
      const excelFiles = [
        '1. Отеч.лек...xls',
        '2. СНГлек.ср..xls2 (1).xls',
        '3. Заруб.лек.ср. (3).xls',
      ];

      for (const fileName of excelFiles) {
        const filePath = path.join(process.cwd(), 'public', fileName);
        this.logger.log(`Processing file: ${fileName}`);

        // Check if file exists and is readable
        if (!this.checkFileExists(filePath)) {
          const errorMsg = `File not found or not accessible: ${fileName}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
          continue;
        }

        try {
          const fileResult = await this.parseExcelFile(filePath);
          result.totalProcessed += fileResult.totalProcessed;
          result.created += fileResult.created;
          result.skipped += fileResult.skipped;
          result.errors.push(...fileResult.errors);
        } catch (error) {
          const errorMsg = `Error processing ${fileName}: ${error.message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      this.logger.log(
        `Import completed. Processed: ${result.totalProcessed}, Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Import failed: ${error.message}`);
      throw error;
    }
  }

  private async parseExcelFile(filePath: string): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();

    const result: ImportResult = {
      totalProcessed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Try to read the Excel file with better error handling
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        result.errors.push(`No worksheets found in file: ${filePath}`);
        return result;
      }

      this.logger.log(
        `Processing worksheet "${worksheet.name}" with ${worksheet.rowCount} rows`,
      );

      // Skip header row and process data
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        try {
          const excelRow: ExcelRow = {
            internationalName: this.getCellValue(row, 3), // Active ingredient
            tradeName: this.getCellValue(row, 2), // Trade name
            manufacturer: this.getCellValue(row, 6), // Manufacturer
            dosageForm: this.getCellValue(row, 4), // Dosage form
            strength: this.extractStrengthFromDosageForm(
              this.getCellValue(row, 4),
            ), // Extract from dosage form
            packageSize: this.extractPackageSizeFromDosageForm(
              this.getCellValue(row, 4),
            ), // Extract from dosage form
            registrationNumber: this.getCellValue(row, 9), // Registration number
          };

          if (this.validateRow(excelRow)) {
            const created = await this.createMedicineFromRow(excelRow);
            if (created) {
              result.created++;
            } else {
              result.skipped++;
            }
          } else {
            result.skipped++;
          }

          result.totalProcessed++;
        } catch (error) {
          result.errors.push(`Row ${rowNumber}: ${error.message}`);
          result.totalProcessed++;
        }
      }
    } catch (error) {
      const errorMsg = `Failed to read Excel file with ExcelJS ${filePath}: ${error.message}`;
      this.logger.error(errorMsg);

      // Try alternative parsing with xlsx library
      this.logger.log(`Trying alternative parsing method for ${filePath}`);
      try {
        return await this.parseExcelFileWithXLSX(filePath);
      } catch (xlsxError) {
        result.errors.push(errorMsg);
        result.errors.push(
          `Alternative parsing also failed: ${xlsxError.message}`,
        );

        // If it's a ZIP/corruption error, provide helpful message
        if (
          error.message.includes('zip') ||
          error.message.includes('central directory')
        ) {
          result.errors.push(
            `File appears to be corrupted or not a valid Excel file: ${filePath}`,
          );
        }
      }
    }

    return result;
  }

  private getCellValue(row: ExcelJS.Row, cellNumber: number): string {
    const cell = row.getCell(cellNumber);
    return cell.value ? String(cell.value).trim() : '';
  }

  private validateRow(row: ExcelRow): boolean {
    return !!(
      row.internationalName &&
      row.tradeName &&
      row.manufacturer &&
      row.dosageForm &&
      row.strength
    );
  }

  private checkFileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (error) {
      this.logger.error(`Error checking file ${filePath}: ${error.message}`);
      return false;
    }
  }

  private async parseExcelFileWithXLSX(
    filePath: string,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalProcessed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Read the Excel file using xlsx library
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        result.errors.push(`No worksheets found in file: ${filePath}`);
        return result;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      this.logger.log(
        `Processing worksheet "${sheetName}" with ${jsonData.length} rows using xlsx`,
      );
      // Skip header row and process data
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex] as any[];

        try {
          const excelRow: ExcelRow = {
            internationalName: this.getStringValue(row[2]), // Active ingredient
            tradeName: this.getStringValue(row[1]), // Trade name
            manufacturer: this.getStringValue(row[5]), // Manufacturer
            dosageForm: this.getStringValue(row[3]), // Dosage form
            strength: this.extractStrengthFromDosageForm(
              this.getStringValue(row[3]),
            ), // Extract from dosage form
            packageSize: this.extractPackageSizeFromDosageForm(
              this.getStringValue(row[3]),
            ), // Extract from dosage form
            registrationNumber: this.getStringValue(row[8]), // Registration number
          };

          if (this.validateRow(excelRow)) {
            const created = await this.createMedicineFromRow(excelRow);
            if (created) {
              result.created++;
            } else {
              result.skipped++;
            }
          } else {
            result.skipped++;
          }

          result.totalProcessed++;
        } catch (error) {
          result.errors.push(`Row ${rowIndex + 1}: ${error.message}`);
          result.totalProcessed++;
        }
      }
    } catch (error) {
      const errorMsg = `Failed to read Excel file with xlsx ${filePath}: ${error.message}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  private getStringValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  private extractStrengthFromDosageForm(dosageForm: string): string {
    // Extract strength from dosage form like "Таблетки, покрытые пленочной оболочкой 25 мг N10 (блистеры)"
    const strengthMatch = dosageForm.match(
      /(\d+(?:\.\d+)?)\s*(мг|g|г|%|IU|мкг|μg)/i,
    );
    if (strengthMatch) {
      return `${strengthMatch[1]}${strengthMatch[2]}`;
    }
    return '';
  }

  private extractPackageSizeFromDosageForm(dosageForm: string): string {
    // Extract package size from dosage form like "Таблетки, покрытые пленочной оболочкой 25 мг N10 (блистеры)"
    const packageMatch = dosageForm.match(/N(\d+)/i);
    if (packageMatch) {
      return `${packageMatch[1]} tablets`;
    }
    return '';
  }

  private async createMedicineFromRow(row: ExcelRow): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      // Check if medicine already exists by registration number
      if (row.registrationNumber) {
        const existing = await tx.medicine.findUnique({
          where: { registration_number: row.registrationNumber },
        });
        if (existing) {
          return false; // Skip duplicate
        }
      }

      // Create or find manufacturer
      const manufacturer = await tx.manufacturer.upsert({
        where: { name: row.manufacturer },
        update: {},
        create: { name: row.manufacturer },
      });

      // Create or find dosage form
      const dosageForm = await tx.dosageForm.upsert({
        where: { name: row.dosageForm },
        update: {},
        create: { name: row.dosageForm },
      });

      // Parse strength
      const parsedStrength = StrengthParser.parse(row.strength);

      // Create medicine
      const medicine = await tx.medicine.create({
        data: {
          trade_name: row.tradeName,
          registration_number: row.registrationNumber || null,
          strength: row.strength || null,
          strength_numeric: parsedStrength?.value || null,
          strength_unit: parsedStrength?.unit || null,
          package_size: row.packageSize || null,
          manufacturer_id: manufacturer.id,
          dosage_form_id: dosageForm.id,
        },
      });

      // Create or find active ingredient and link to medicine
      const activeIngredient = await tx.activeIngredient.upsert({
        where: { name: row.internationalName },
        update: {},
        create: { name: row.internationalName },
      });

      await tx.medicineActiveIngredient.create({
        data: {
          medicine_id: medicine.id,
          active_ingredient_id: activeIngredient.id,
        },
      });

      return true;
    });
  }

  /**
   * Scrape medicine data from ArzonApteka API
   * Uses Puppeteer to make POST request with proper headers and form data
   */
  async scrapeArzonApteka(searchTerm: string = 'midaks'): Promise<ImportResult> {
    this.logger.log(`Starting ArzonApteka scraping for search term: ${searchTerm}`);
    
    const result: ImportResult = {
      totalProcessed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    let browser: puppeteer.Browser | null = null;

    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Set user agent to avoid detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );

      // API configuration - can be overridden via environment variables
      const apiUrl = 'https://api.arzonapteka.name/api/v4/ru/trigrams';
      const apiKey = process.env.ARZON_API_KEY || 'ba6263952cd57f83c10983bfaddd0308';
      const userId = process.env.ARZON_USER_ID || 'a081b16b-0466-49d6-a377-69256599b628';
      const region = process.env.ARZON_REGION || '-3';
      const countryCode = process.env.ARZON_COUNTRY_CODE || '1';

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Api-Key': apiKey,
      });

      this.logger.log(`Making POST request to ArzonApteka API with search: ${searchTerm}`);

      // Make POST request with form data using fetch in browser context
      const apiResponse = await page.evaluate(
        async (url, apiKey, userId, search, region, countryCode, detail, platform) => {
          const formData = new FormData();
          formData.append('user', userId);
          formData.append('search', search);
          formData.append('region', region);
          formData.append('country_code', countryCode);
          formData.append('detail', detail);
          formData.append('platform', platform);

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Accept': '*/*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Api-Key': apiKey,
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return await response.json();
        },
        apiUrl,
        apiKey,
        userId,
        searchTerm,
        region,
        countryCode,
        'true', // detail
        'web', // platform
      );

      this.logger.log(`API Response received: ${JSON.stringify(apiResponse).substring(0, 500)}`);
      console.log(1111111, apiResponse);
      // Process the API response
      if (apiResponse && apiResponse.ok !== false) {
        if (apiResponse.result && Array.isArray(apiResponse.result)) {
          this.logger.log(`Found ${apiResponse.result.length} medicines in API response`);

          result.totalProcessed = apiResponse.result.length;

          // Process each medicine and save to database
          for (const medicine of apiResponse.result) {
            try {
              const created = await this.processArzonMedicine(medicine);
              if (created) {
                result.created++;
              } else {
                result.skipped++;
              }
            } catch (error) {
              this.logger.error(`Error processing medicine: ${error.message}`);
              result.errors.push(`Error processing medicine: ${error.message}`);
            }
          }
        } else if (apiResponse.result && typeof apiResponse.result === 'object') {
          // Handle single medicine object
          try {
            const created = await this.processArzonMedicine(apiResponse.result);
            if (created) {
              result.created++;
              result.totalProcessed = 1;
            } else {
              result.skipped++;
              result.totalProcessed = 1;
            }
          } catch (error) {
            this.logger.error(`Error processing medicine: ${error.message}`);
            result.errors.push(`Error processing medicine: ${error.message}`);
          }
        } else {
          this.logger.warn(`Unexpected API response format: ${JSON.stringify(apiResponse).substring(0, 200)}`);
          result.errors.push('Unexpected API response format');
        }
      } else {
        this.logger.warn(`API returned error: ${JSON.stringify(apiResponse)}`);
        result.errors.push(apiResponse.error || 'API returned error');
      }

      await browser.close();
      browser = null;

      this.logger.log(
        `Scraping completed. Processed: ${result.totalProcessed}, Created: ${result.created}, Skipped: ${result.skipped}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed: ${error.message}`, error.stack);
      result.errors.push(`Scraping error: ${error.message}`);

      if (browser) {
        await browser.close();
      }

      return result;
    }
  }

  /**
   * Process a single medicine from ArzonApteka API response
   * Adapt this based on the actual API response structure
   */
  private async processArzonMedicine(medicine: any): Promise<boolean> {
    try {
      // TODO: Adapt this based on the actual ArzonApteka API response structure
      // This is a placeholder implementation

      // Example structure (adjust based on actual API):
      // {
      //   id: string,
      //   name: string,
      //   price: number,
      //   manufacturer: string,
      //   active_ingredient: string,
      //   ...
      // }

      if (!medicine || !medicine.name) {
        this.logger.warn('Medicine missing required fields, skipping');
        return false;
      }

      // Check if medicine already exists (by name or registration number)
      const existing = await this.prisma.medicine.findFirst({
        where: {
          OR: [
            { trade_name: medicine.name },
            { registration_number: medicine.registration_number || medicine.id },
          ],
        },
      });

      if (existing) {
        this.logger.debug(`Medicine ${medicine.name} already exists, skipping`);
        return false;
      }

      // Create or find manufacturer
      let manufacturer = null;
      if (medicine.manufacturer || medicine.manufacturer_name) {
        manufacturer = await this.prisma.manufacturer.upsert({
          where: { name: medicine.manufacturer || medicine.manufacturer_name },
          update: {},
          create: {
            name: medicine.manufacturer || medicine.manufacturer_name,
            country: medicine.country || null,
            is_local: medicine.is_local || false,
          },
        });
      }

      // Create or find dosage form
      let dosageForm = null;
      if (medicine.dosage_form || medicine.form) {
        dosageForm = await this.prisma.dosageForm.upsert({
          where: { name: medicine.dosage_form || medicine.form },
          update: {},
          create: {
            name: medicine.dosage_form || medicine.form,
          },
        });
      }

      // Parse strength
      const strength = medicine.strength || medicine.dosage || '';
      const parsedStrength = StrengthParser.parse(strength);

      // Create medicine
      const createdMedicine = await this.prisma.medicine.create({
        data: {
          trade_name: medicine.name || medicine.trade_name,
          registration_number: medicine.registration_number || medicine.id || null,
          strength: strength || null,
          strength_numeric: parsedStrength?.value || null,
          strength_unit: parsedStrength?.unit || null,
          package_size: medicine.package_size || medicine.package || null,
          price_uzs: medicine.price ? parseFloat(medicine.price.toString()) : null,
          manufacturer_id: manufacturer?.id || null,
          dosage_form_id: dosageForm?.id || null,
          is_generic: medicine.is_generic || false,
          is_available: medicine.is_available !== false,
          prescription_required: medicine.prescription_required || true,
        },
      });

      // Create or find active ingredient and link to medicine
      if (medicine.active_ingredient || medicine.ingredient) {
        const activeIngredient = await this.prisma.activeIngredient.upsert({
          where: { name: medicine.active_ingredient || medicine.ingredient },
          update: {},
          create: { name: medicine.active_ingredient || medicine.ingredient },
        });

        await this.prisma.medicineActiveIngredient.create({
          data: {
            medicine_id: createdMedicine.id,
            active_ingredient_id: activeIngredient.id,
          },
        });
      }

      this.logger.debug(`Successfully created medicine: ${createdMedicine.trade_name}`);
      return true;
    } catch (error) {
      this.logger.error(`Error processing Arzon medicine: ${error.message}`);
      throw error;
    }
  }
}
