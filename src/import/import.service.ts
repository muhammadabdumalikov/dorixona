import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { StrengthParser } from '../common/utils/strength-parser.util';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

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
        // '1. Отеч.лек...xls',
        '2. СНГлек.ср..xls2 (1).xls',
        // '3. Заруб.лек.ср. (3).xls',
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
          where: { registrationNumber: row.registrationNumber },
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
          tradeName: row.tradeName,
          registrationNumber: row.registrationNumber || null,
          strength: row.strength || null,
          strengthNumeric: parsedStrength?.value || null,
          strengthUnit: parsedStrength?.unit || null,
          packageSize: row.packageSize || null,
          manufacturerId: manufacturer.id,
          dosageFormId: dosageForm.id,
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
          medicineId: medicine.id,
          activeIngredientId: activeIngredient.id,
        },
      });

      return true;
    });
  }
}
