import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HuntsService } from './hunts.service';

@Injectable()
export class HuntSchedulerService {
  private readonly logger = new Logger(HuntSchedulerService.name);
  private running = false;

  constructor(private readonly huntsService: HuntsService) {}

  // Check every minute for scheduled hunts due to run
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueSchedules() {
    if (this.running) return; // prevent overlap
    this.running = true;
    try {
      const due = await this.huntsService.getDueSchedules();
      if (due.length === 0) return;

      this.logger.log(`[THaaS-Cron] ${due.length} schedule(s) due to run`);

      for (const schedule of due) {
        if (
          schedule.integration.platform !== 'SPLUNK' ||
          schedule.integration.status !== 'CONNECTED'
        ) {
          this.logger.warn(
            `[THaaS-Cron] Skipping ${schedule.scheduleRef} — integration not CONNECTED`,
          );
          continue;
        }
        try {
          const result = await this.huntsService.executeScheduleRun(
            schedule as Parameters<typeof this.huntsService.executeScheduleRun>[0],
          );
          this.logger.log(
            `[THaaS-Cron] ${schedule.scheduleRef} complete — status=${result.status} results=${result.totalResults}${result.missionId ? ` mission=${result.missionId}` : ''}`,
          );
        } catch (err) {
          this.logger.error(`[THaaS-Cron] ${schedule.scheduleRef} failed: ${String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
