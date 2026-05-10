import './config'; // validates env vars before anything else runs
import { createLogger } from '@synchive/logger';
import { syncSchedules, stopAllSchedules, getActiveJobCount } from './scheduler';
import { closeQueue } from './queue';
import { config } from './config';

const logger = createLogger({ service: 'scheduler' });

async function main() {
  try {
    logger.info({ env: config.nodeEnv }, 'Scheduler starting');

    await syncSchedules();

    logger.info({ activeJobs: getActiveJobCount() }, 'Scheduler running');

    // Periodically re-sync so newly activated/deactivated workflows are picked up
    setInterval(async () => {
      logger.info('Running periodic schedule sync');
      await syncSchedules();
    }, config.syncIntervalMs);

  } catch (err) {
    logger.fatal({ err }, 'Scheduler failed to start');
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  stopAllSchedules();
  await closeQueue();
  logger.info('Scheduler shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main();