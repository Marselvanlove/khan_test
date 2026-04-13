import { readFile } from "node:fs/promises";
import process from "node:process";
import { mapMockOrderToRetailCrmOrder } from "../src/shared/orders";
import { createRetailCrmClient, isDuplicateExternalIdError } from "../src/shared/retailcrm";
import type { MockOrder } from "../src/shared/types";

const REQUEST_DELAY_MS = 150;

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value.trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readMockOrders(): Promise<MockOrder[]> {
  const fileUrl = new URL("../mock_orders.json", import.meta.url);
  const file = await readFile(fileUrl, "utf8");

  return JSON.parse(file) as MockOrder[];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const orders = await readMockOrders();

  const retailCrm = createRetailCrmClient({
    baseUrl: readRequiredEnv("RETAILCRM_BASE_URL"),
    apiKey: readRequiredEnv("RETAILCRM_API_KEY"),
    defaultSite: readRequiredEnv("RETAILCRM_SITE_CODE"),
  });

  const stats = {
    created: 0,
    skipped: 0,
    failed: 0,
  };

  for (const [index, order] of orders.entries()) {
    const payload = mapMockOrderToRetailCrmOrder(order, index, orders.length, {
      siteCode: readRequiredEnv("RETAILCRM_SITE_CODE"),
      orderType: process.env.RETAILCRM_ORDER_TYPE,
      orderMethod: process.env.RETAILCRM_ORDER_METHOD,
      status: process.env.RETAILCRM_STATUS,
      utmFieldCode: process.env.RETAILCRM_UTM_FIELD_CODE,
    });

    if (dryRun) {
      console.log(`DRY RUN ${payload.externalId} -> ${payload.firstName} ${payload.lastName}`);
      continue;
    }

    try {
      const response = await retailCrm.createOrder(payload);
      stats.created += 1;
      console.log(`CREATED ${payload.externalId} -> RetailCRM ID ${response.id ?? "n/a"}`);
    } catch (error) {
      if (isDuplicateExternalIdError(error)) {
        stats.skipped += 1;
        console.log(`SKIPPED ${payload.externalId} already exists`);
      } else {
        stats.failed += 1;
        console.error(`FAILED ${payload.externalId}:`, error);
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("\nImport summary");
  console.log(`created=${stats.created}`);
  console.log(`skipped=${stats.skipped}`);
  console.log(`failed=${stats.failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

