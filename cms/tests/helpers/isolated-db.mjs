// Preload (node --import) der giver HVER testproces sin egen throwaway SQLite-fil.
//
// Kaldes af scripts/test-runner.ts, som sætter:
//   CMS_TEST_TEMPLATE  sti til en frisk-seedet skabelon-database
//   CMS_TEST_RUN_DIR   mappe til denne kørsel (slettes af runneren bagefter)
//
// node --test starter hver testfil som egen proces og videregiver --import, så
// hver fil får sin egen kopi (test-<pid>.db). Ingen deler lås eller data med
// prisma/dev.db eller med andre kørsler. Uden CMS_TEST_TEMPLATE gør filen
// ingenting (npm run test:dev-db bruger den gamle adfærd mod DATABASE_URL).
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const template = process.env.CMS_TEST_TEMPLATE;
const runDir = process.env.CMS_TEST_RUN_DIR;

if (template && runDir) {
  const file = join(runDir, `test-${process.pid}.db`);
  copyFileSync(template, file);
  process.env.DATABASE_URL = `file:${file}`;
  const cleanup = () => {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (existsSync(file + suffix)) rmSync(file + suffix, { force: true });
    }
  };
  process.on("exit", cleanup);
}
