// Opt-in pre-commit (se docs/ops/CI.md). Køres af `npm run precommit` — installerer ingen git-hooks.
// Fejler kun på ESLint-FEJL (advarsler hører til LINT-BACKLOG/ratchet i CI), typefejl og fundne hemmeligheder.
const config = {
  "*.{ts,tsx,mjs,js}": (files) => {
    const list = files.map((f) => JSON.stringify(f)).join(" ");
    return [`eslint --no-warn-ignored ${list}`];
  },
  // tsc tjekker hele projektet (ikke enkeltfiler), så kun ét kald uanset antal staged filer.
  "*.{ts,tsx}": () => "tsc --noEmit",
  "*": (files) => `tsx scripts/check-secrets.ts ${files.map((f) => JSON.stringify(f)).join(" ")}`,
};

export default config;
