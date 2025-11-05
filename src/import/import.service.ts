import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { StrengthParser } from '../common/utils/strength-parser.util';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import OpenAI from 'openai';

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
  private openai: OpenAI | null = null;

  constructor(private prisma: PrismaService) {
    // Initialize OpenAI client if API key is provided
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log('OpenAI client initialized');
    } else {
      this.logger.warn('OPENAI_API_KEY not found in environment variables');
    }
  }

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
   * Scrape medicine data from ArzonApteka API and update prices using OpenAI
   * Flow: 1. Get first result from ArzonApteka 2. Analyze with OpenAI 3. Update price
   */
  async scrapeArzonApteka(searchTerm?: string): Promise<ImportResult> {
    this.logger.log(`Starting ArzonApteka scraping and price update process...`);
    
    const result: ImportResult = {
      totalProcessed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Step 1: Get all medicines from our database that need price updates
      const medicinesToUpdate = await this.prisma.medicine.findMany({
        where: {
          OR: [
            { price_uzs: null, cron_price_processed: false },
            { price_last_updated: null, cron_price_processed: false },
          ],
        },
        include: {
          manufacturers: true,
          dosage_forms: true,
          medicine_active_ingredients: {
            include: {
              active_ingredients: true,
            },
          },
        },
        take: 1, // Process in batches
      });

      if (medicinesToUpdate.length === 0) {
        this.logger.log('No medicines found that need price updates');
        return result;
      }

      this.logger.log(`Found ${medicinesToUpdate.length} medicines to update prices for`);

      // Step 2: Process each medicine
      for (const medicine of medicinesToUpdate) {
        try {
          // Search for this medicine on ArzonApteka
          const searchTerm = medicine.trade_name;
          const arzonResult = await this.searchArzonApteka(searchTerm);

          if (!arzonResult || !arzonResult.result || !Array.isArray(arzonResult.result) || arzonResult.result.length === 0) {
            this.logger.warn(`No results from ArzonApteka for: ${searchTerm}`);
            result.skipped++;
            continue;
          }

          // Step 3: Get five similar medicines from ArzonApteka result
          const arzonMedicines = arzonResult.result.slice(0, 5);
          this.logger.log(`Found ${arzonMedicines.length} similar medicines from ArzonApteka for: ${searchTerm}`);
          // Step 4: Analyze with OpenAI to identify which medicine matches best and get its price
          const analysisResult = await this.analyzeMedicineWithOpenAI(medicine, arzonMedicines);

          console.log(111111, analysisResult);

          if (analysisResult && analysisResult.price) {
            // Step 5: Update medicine price in database
            await this.prisma.medicine.update({
              where: { id: medicine.id },
              data: {
                price_uzs: analysisResult.price,
                price_last_updated: new Date(),
                cron_price_processed: true,
                cron_processed_count: {
                  increment: 1,
                },
              },
            });

            const matchInfo = analysisResult.matchedIndex !== undefined 
              ? ` (matched index ${analysisResult.matchedIndex}, confidence: ${analysisResult.confidence || 'N/A'})`
              : '';
            this.logger.log(`Updated price for ${medicine.trade_name}: ${analysisResult.price} UZS${matchInfo}`);
            result.created++;
          } else {
            await this.prisma.medicine.update({
              where: { id: medicine.id },
              data: {
                cron_price_processed: true,
                cron_processed_count: {
                  increment: 1,
                },
              },
            })
            this.logger.warn(`OpenAI analysis did not find a matching medicine or price for ${medicine.trade_name}`);
            result.skipped++;
          }

          result.totalProcessed++;

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.error(`Error processing medicine ${medicine.trade_name}: ${error.message}`);
          result.errors.push(`Error processing ${medicine.trade_name}: ${error.message}`);
          result.skipped++;
        }
      }

      this.logger.log(
        `Scraping completed. Processed: ${result.totalProcessed}, Updated: ${result.created}, Skipped: ${result.skipped}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed: ${error.message}`, error.stack);
      result.errors.push(`Scraping error: ${error.message}`);
      return result;
    }
  }

  /**
   * Search ArzonApteka API for a medicine
   */
  private async searchArzonApteka(searchTerm: string): Promise<any> {
    let browser: puppeteer.Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );

      const apiUrl = 'https://api.arzonapteka.name/api/v4/ru/trigrams';
      const apiKey = process.env.ARZON_API_KEY || 'ba6263952cd57f83c10983bfaddd0308';
      const userId = process.env.ARZON_USER_ID || 'a081b16b-0466-49d6-a377-69256599b628';
      const region = process.env.ARZON_REGION || '-3';
      const countryCode = process.env.ARZON_COUNTRY_CODE || '1';

      await page.setExtraHTTPHeaders({
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Api-Key': apiKey,
      });

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
        'true',
        'web',
      );

      await browser.close();
      return apiResponse;
    } catch (error) {
      this.logger.error(`ArzonApteka search failed: ${error.message}`);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  /**
   * Analyze medicine with OpenAI to match against array of ArzonApteka results and get best match price
   */
  private async analyzeMedicineWithOpenAI(ourMedicine: any, arzonMedicines: any[]): Promise<{ price: number; confidence?: string; matchedIndex?: number } | null> {
    if (!this.openai) {
      this.logger.error('OpenAI client not initialized. Please set OPENAI_API_KEY environment variable.');
      return null;
    }

    if (!arzonMedicines || arzonMedicines.length === 0) {
      this.logger.warn('No ArzonApteka medicines provided for analysis');
      return null;
    }

    try {
      const prompt = `You are a pharmaceutical data analyst. I need you to analyze our medicine record against multiple similar medicines from ArzonApteka and identify which one is the exact match, then provide its price in Uzbek Som (UZS).

Our Medicine Data:
- Trade Name: ${ourMedicine.trade_name}
- Registration Number: ${ourMedicine.registration_number || 'N/A'}
- Manufacturer: ${ourMedicine.manufacturers?.name || 'N/A'}
- Strength: ${ourMedicine.strength || 'N/A'}
- Dosage Form: ${ourMedicine.dosage_forms?.name || 'N/A'}
- Package Size: ${ourMedicine.package_size || 'N/A'}
- Active Ingredients: ${ourMedicine.medicine_active_ingredients.map((mai: any) => mai.active_ingredients.name).join(', ') || 'N/A'}

ArzonApteka Results (array of similar medicines from search):
${JSON.stringify(arzonMedicines, null, 2)}

Please analyze ALL ArzonApteka medicines and:
1. Identify which medicine from the array is the EXACT match to our medicine (by index, starting from 0)
2. Determine match confidence (high/medium/low)
3. If a match is found, extract the price in Uzbek Som (UZS) from that matched medicine
4. If multiple medicines match, pick the one with highest confidence or best data quality
5. Return ONLY a JSON object in this exact format:
{
  "is_match": true/false,
  "matched_index": 0,
  "confidence": "high/medium/low",
  "price": 12345.50,
  "matched_medicine_name": "name from ArzonApteka",
  "reason": "brief explanation of why this medicine was selected"
}

Important:
- Compare trade names, manufacturers, strengths, dosage forms, and active ingredients
- Match index should be the position in the array (0 for first, 1 for second, etc.)
- If prices are in different formats or currencies, convert to UZS
- If no exact match is found, set "is_match" to false and "price" to null
- Prefer medicines with complete information and matching active ingredients`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a pharmaceutical data analyst expert in matching medicine records and extracting pricing information. You excel at comparing multiple similar medicines and identifying the exact match.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        this.logger.error('OpenAI returned empty response');
        return null;
      }

      const analysis = JSON.parse(responseText);
      this.logger.log(`OpenAI Analysis for ${ourMedicine.trade_name}: ${JSON.stringify(analysis)}`);

      if (analysis.is_match && analysis.price !== null && analysis.price !== undefined) {
        // Validate matched index is within array bounds
        const matchedIndex = analysis.matched_index;
        if (matchedIndex !== undefined && matchedIndex >= 0 && matchedIndex < arzonMedicines.length) {
          this.logger.log(`Matched medicine at index ${matchedIndex}: ${analysis.matched_medicine_name || 'N/A'}`);
          return {
            price: parseFloat(analysis.price),
            confidence: analysis.confidence,
            matchedIndex: matchedIndex,
          };
        } else {
          this.logger.warn(`Invalid matched_index ${matchedIndex} for array of length ${arzonMedicines.length}`);
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`OpenAI analysis failed: ${error.message}`);
      return null;
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
      console.log(2222222, medicine);
      
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
