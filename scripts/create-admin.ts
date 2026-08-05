import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/features/auth/password";
import { signupInputSchema } from "../src/features/auth/validation";
import { prismaPgAdapterConfig } from "../src/lib/database-url";

function argument(name: string) {
  const prefix = `${name}=`;
  const direct = process.argv.find((value) => value.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readHiddenPassword() {
  const fromEnvironment = process.env.ADMIN_CREATE_PASSWORD;
  if (fromEnvironment) return fromEnvironment;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive input is unavailable. Set ADMIN_CREATE_PASSWORD for this one command only.",
    );
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        cleanup();
        output.write("\n");
        reject(new Error("Administrator creation was cancelled."));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        output.write("\n");
        resolve(value);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        value = Array.from(value).slice(0, -1).join("");
        return;
      }
      if (!chunk.startsWith("\u001b")) value += chunk;
    };

    output.write("New administrator password (hidden): ");
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL or DIRECT_URL is required.");

  const loginId = argument("--login-id");
  const displayName = argument("--display-name");
  if (!loginId || !displayName) {
    throw new Error(
      "Usage: pnpm admin:create -- --login-id <id> --display-name <name>",
    );
  }

  const password = await readHiddenPassword();
  const parsed = signupInputSchema.safeParse({
    loginId,
    displayName,
    password,
    passwordConfirm: password,
    termsAccepted: true,
    privacyAccepted: true,
  });
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(`Invalid administrator input: ${messages}`);
  }

  const adapterConfig = prismaPgAdapterConfig(databaseUrl);
  const adapter = new PrismaPg(
    adapterConfig.poolConfig,
    adapterConfig.adapterOptions,
  );
  const prisma = new PrismaClient({ adapter });
  try {
    const activeAdminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    if (activeAdminCount > 0) {
      throw new Error(
        "An active administrator already exists. Use the audited role-change service for additional administrators.",
      );
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          loginId: parsed.data.loginId,
          loginIdNormalized: parsed.data.loginIdNormalized,
          realName: parsed.data.displayName,
          passwordHash,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, loginId: true },
      });
      await transaction.auditLog.create({
        data: {
          action: "ADMIN_BOOTSTRAPPED",
          targetType: "User",
          targetId: created.id,
          reason: "pnpm admin:create one-time CLI",
          after: { role: UserRole.ADMIN },
        },
      });
      return created;
    });

    console.info(`Administrator "${user.loginId}" was created.`);
    console.info(
      "The password was not printed. Store it in an approved password manager.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`admin:create failed: ${message}`);
  process.exitCode = 1;
});
