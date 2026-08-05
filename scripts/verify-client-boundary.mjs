import { ESLint } from "eslint";

const eslint = new ESLint();
const [result] = await eslint.lintText(
  `"use client";
import { serverEnv } from "@/lib/env/server";
export const leakedMode = serverEnv.SYNC_MODE;
`,
  { filePath: "src/components/verification.client.tsx" },
);

const blocked = result?.messages.some(
  (message) =>
    message.ruleId === "deluxe-boundaries/no-client-server-env" &&
    message.severity === 2,
);

if (!blocked) {
  throw new Error(
    "Client/server environment lint boundary verification did not report the forbidden import.",
  );
}

console.info("Client/server environment lint boundary confirmed.");
