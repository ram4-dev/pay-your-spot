import { rm } from "node:fs/promises";

import { E2E_DATABASE_PATH } from "../playwright.config";

export default async function globalSetup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    await rm(`${E2E_DATABASE_PATH}${suffix}`, { force: true });
  }
}
