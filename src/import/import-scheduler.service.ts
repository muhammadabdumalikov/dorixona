import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImportService } from './import.service';

@Injectable()
export class ImportSchedulerService {
  private readonly logger = new Logger(ImportSchedulerService.name);
  private isRunning = false;

  constructor(private readonly importService: ImportService) {}

//   /**
//    * Run scraping every 20 seconds
//    * Using cron expression: */20 * * * * * (every 20 seconds)
//    */
  @Cron('*/25 * * * * *')
  async handleScrapingCron() {
    // Prevent overlapping executions
    if (this.isRunning) {
      this.logger.warn('Previous scraping job still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled ArzonApteka scraping...');

    try {
      const result = await this.importService.scrapeArzonApteka();
      
      this.logger.log(
        `Scraping job completed - Processed: ${result.totalProcessed}, Created: ${result.created}, Errors: ${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`Scraping errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Scheduled scraping failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }
}

