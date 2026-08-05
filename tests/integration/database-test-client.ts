import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { prismaPgAdapterConfig } from "@/lib/database-url";

export function createDatabaseTestClient(databaseUrl: string) {
  const adapterConfig = prismaPgAdapterConfig(databaseUrl);
  const adapter = new PrismaPg(
    adapterConfig.poolConfig,
    adapterConfig.adapterOptions,
  );
  return new PrismaClient({ adapter });
}

class TransactionRollback extends Error {
  override readonly name = "TransactionRollback";
}

class ResultBox<T> {
  private result: { readonly value: T } | undefined;

  set(value: T) {
    this.result = { value };
  }

  get() {
    const result = this.result;
    if (!result) {
      throw new Error(
        "Rollback transaction completed without a callback result.",
      );
    }
    return result.value;
  }
}

export async function withRollback<T>(
  client: PrismaClient,
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const rollback = new TransactionRollback();
  const result = new ResultBox<T>();

  try {
    await client.$transaction(async (transaction) => {
      const value = await callback(transaction);
      result.set(value);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  return result.get();
}
