import assert from "node:assert/strict";
import test from "node:test";
import { checkEnv } from "../lib/env";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:hunter2-db-password@host:5432/db",
  AUTH_SECRET: "x".repeat(40),
  NEXT_PUBLIC_APP_URL: "https://slagelselokalt.dk",
  CRON_SECRET: "c".repeat(20),
};
const warn = (extra: Record<string, string>) => checkEnv({ ...base, ...extra } as unknown as NodeJS.ProcessEnv).warnings.filter((w) => /AI_PROVIDER/.test(w));

test("AI-gateway-miljø: advarsler for ugyldige/uopfyldte AI_PROVIDER-valg (kun navne, aldrig værdier), aldrig fejl", () => {
  assert.deepEqual(warn({}), []);
  assert.deepEqual(warn({ AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k-123456789" }), []);
  assert.match(warn({ AI_PROVIDER: "deepseek" })[0], /AI_PROVIDER=deepseek, men DEEPSEEK_API_KEY mangler/);
  assert.match(warn({ CHAT_AI_PROVIDER: "anthropic" })[0], /CHAT_AI_PROVIDER=anthropic, men ANTHROPIC_API_KEY mangler — AI-chatten/);
  assert.match(warn({ EDITOR_AI_PROVIDER: "gpt" })[0], /EDITOR_AI_PROVIDER skal være 'deepseek' eller 'anthropic'/);
  assert.match(warn({ FRONTPAGE_AI_PROVIDER: "deepseek" })[0], /FRONTPAGE_AI_PROVIDER=deepseek/);
  const r = checkEnv({ ...base, AI_PROVIDER: "hemmelig-vaerdi" } as unknown as NodeJS.ProcessEnv);
  assert.equal(r.ok, true, "kun advarsler");
  assert.equal(JSON.stringify(r).includes("hemmelig-vaerdi"), false, "værdier gengives aldrig");
});
