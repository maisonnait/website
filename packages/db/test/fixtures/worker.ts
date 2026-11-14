/**
 * Child process used by shared-pglite.test.ts. It works on the local database named by
 * NAIT_PGLITE_DIR at the same time as other processes.
 *
 *   worker.ts work <restockVariantId> <orderVariantId> <rounds>   restocks and orders, prints a JSON report
 *   worker.ts crash                                               opens the database, then dies without cleaning up
 */
import { adjustStock, closeDb, getDb, isDomainError, placeOrder } from '../../src/index';

const [mode, restockVariantId = '', orderVariantId = '', rounds = '0'] = process.argv.slice(2);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (mode === 'crash') {
  await getDb();
  process.stdout.write('opened\n', () => process.kill(process.pid, 'SIGKILL'));
  await pause(60_000);
} else {
  const report = { pid: process.pid, restocked: 0, sold: [] as string[], refused: 0 };
  for (let round = 0; round < Number(rounds); round += 1) {
    await adjustStock(restockVariantId, 1, 'restock', null, `worker ${process.pid}`);
    report.restocked += 1;
    try {
      const placed = await placeOrder({
        customerName: `Worker ${process.pid}`,
        phone: '0612345678',
        city: 'Fès',
        address: '1 rue du Test',
        lang: 'fr',
        items: [{ variantId: orderVariantId, quantity: 1 }],
      });
      report.sold.push(placed.number);
    } catch (error) {
      if (!isDomainError(error) || error.code !== 'OUT_OF_STOCK') throw error;
      report.refused += 1;
    }
    await pause(Math.random() * 40);
  }
  await closeDb();
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
