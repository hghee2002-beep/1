import "server-only";

import {
  LegalDocumentStatus,
  LegalDocumentType,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";

import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "@/features/auth/password";
import type { LoginInput, SignupInput } from "@/features/auth/validation";
import { db } from "@/server/db/client";
import { AuthServiceError } from "@/server/auth/errors";

const DUMMY_PASSWORD = "timing-equalization-password-only";
let dummyPasswordHash: Promise<string> | undefined;

function timingEqualizationHash() {
  dummyPasswordHash ??= hashPassword(DUMMY_PASSWORD);
  return dummyPasswordHash;
}

function hasPrismaErrorCode(error: unknown, code: string) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code,
  );
}

export async function registerUser(input: SignupInput, now = new Date()) {
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.$transaction(async (transaction) => {
      const legalDocuments = await transaction.legalDocument.findMany({
        where: {
          type: {
            in: [LegalDocumentType.TERMS, LegalDocumentType.PRIVACY],
          },
          status: LegalDocumentStatus.PUBLISHED,
          effectiveAt: { lte: now },
          publishedAt: { not: null, lte: now },
        },
        orderBy: { version: "desc" },
        select: { id: true, type: true },
      });
      const terms = legalDocuments.find(
        (document) => document.type === LegalDocumentType.TERMS,
      );
      const privacy = legalDocuments.find(
        (document) => document.type === LegalDocumentType.PRIVACY,
      );

      if (!terms || !privacy) {
        throw new AuthServiceError(
          "LEGAL_DOCUMENT_UNAVAILABLE",
          "현재 가입에 필요한 법적 문서가 게시되어 있지 않습니다.",
        );
      }

      const user = await transaction.user.create({
        data: {
          loginId: input.loginId,
          loginIdNormalized: input.loginIdNormalized,
          realName: input.displayName,
          passwordHash,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
        },
        select: { id: true, loginId: true },
      });

      await transaction.legalConsent.createMany({
        data: [
          {
            userId: user.id,
            legalDocumentId: terms.id,
            acceptedAt: now,
            source: "SIGNUP",
          },
          {
            userId: user.id,
            legalDocumentId: privacy.id,
            acceptedAt: now,
            source: "SIGNUP",
          },
        ],
      });

      return user;
    });
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    if (hasPrismaErrorCode(error, "P2002")) {
      throw new AuthServiceError(
        "LOGIN_ID_UNAVAILABLE",
        "이미 사용 중인 로그인 ID입니다.",
      );
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput, now = new Date()) {
  const user = await db.user.findUnique({
    where: { loginIdNormalized: input.loginIdNormalized },
    select: {
      id: true,
      loginId: true,
      realName: true,
      passwordHash: true,
      role: true,
      status: true,
      sessionVersion: true,
    },
  });

  const hash = user?.passwordHash ?? (await timingEqualizationHash());
  const passwordMatches = await verifyPassword(hash, input.password);

  if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "로그인 ID 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: now,
      ...(passwordHashNeedsUpgrade(user.passwordHash)
        ? { passwordHash: await hashPassword(input.password) }
        : {}),
    },
  });

  return user;
}
