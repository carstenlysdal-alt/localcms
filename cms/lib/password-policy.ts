/**
 * Adgangskodepolitik (ren funktion — bruges både af server actions og af formularens styrkeindikator).
 * Serveren er autoritativ; klienten bruger samme regler til at vise vejledning mens man skriver.
 * Ingen afhængigheder, så filen kan importeres fra klientkomponenter.
 */

export const MIN_PASSWORD_LENGTH = 12;
/** bcrypt ser kun de første 72 BYTES; længere kodeord afvises frem for at blive stille afkortet. */
export const MAX_PASSWORD_BYTES = 72;

/** Lille liste over de mest brugte/gættede kodeord (normaliseret: små bogstaver, kun a-z og 0-9). */
const COMMON_PASSWORDS = new Set([
  "password1234", "password12345", "password123456", "passw0rd1234", "passw0rd12345",
  "adgangskode", "adgangskode1", "adgangskode12", "adgangskode123", "adgangskode1234", "adgangskode12345",
  "kodeord1234", "kodeord12345", "kodeord123456", "kodeordkodeord", "mitkodeord123", "mitkodeord1234",
  "123456789012", "1234567890123", "12345678901234", "123123123123", "111111111111", "000000000000",
  "qwertyuiop12", "qwertyuiopas", "qwertyuiop123", "qwerty123456", "qwertyqwerty", "asdfghjkl123", "asdfghjklzxc",
  "abcdefghijkl", "abc123abc123", "iloveyou1234", "welcome12345", "letmein12345", "administrator", "administrator1", "administrator123",
  "changeme1234", "changeme12345", "changemenow", "cmsdemo2026", "cmsdemo20261", "cmsdemo202612",
  "redaktion1234", "redaktion2026", "redaktion2027", "redaktionen123", "lysdals2026", "lysdals2027", "lysdalscms12",
  "slagelselokalt", "slagelselokalt1", "slagelselokalt123", "naestvedlokalt", "holbaeklokalt", "koegelokalt", "roskildelokalt", "ringstedlokalt",
  "sommer2026", "sommer2027", "vinter2026", "vinter2027", "efteraar2026", "foraar2027", "danmark12345", "danmark2026", "kobenhavn123",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isRepetitiveOrSequential(normalized: string): boolean {
  if (normalized.length === 0) return false;
  if (new Set(normalized).size <= 2) return true;
  // fx "abababababab" eller "123412341234"
  for (let size = 1; size <= 4; size++) {
    if (normalized.length % size === 0 && normalized === normalized.slice(0, size).repeat(normalized.length / size)) return true;
  }
  return false;
}

export type PasswordContext = {
  email?: string | null;
  name?: string | null;
  /** Den nuværende adgangskode i klartekst (kun på serveren, lige efter verificering). */
  current?: string | null;
};

/** Returnerer danske fejlmeddelelser; tom liste = adgangskoden overholder politikken. */
export function validatePassword(password: string, context: PasswordContext = {}): string[] {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) errors.push(`Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn.`);
  if (byteLength(password) > MAX_PASSWORD_BYTES) errors.push(`Adgangskoden må højst fylde ${MAX_PASSWORD_BYTES} bytes (ca. ${MAX_PASSWORD_BYTES} tegn uden specialtegn).`);

  const normalized = normalize(password);
  const identities = [context.email, context.email?.split("@")[0], context.name]
    .filter((v): v is string => Boolean(v))
    .map(normalize)
    .filter((v) => v.length >= 3);
  if (identities.includes(normalized)) errors.push("Adgangskoden må ikke være din e-mail eller dit navn.");
  if (COMMON_PASSWORDS.has(normalized) || isRepetitiveOrSequential(normalized)) errors.push("Adgangskoden er for almindelig eller for let at gætte. Vælg en længere sætning, som kun du kender.");
  if (context.current != null && password === context.current) errors.push("Den nye adgangskode skal være en anden end den nuværende.");
  return errors;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3; label: string; hint: string };

/** Vejledende styrke (kun til visning; politikken afgør hvad der accepteres). */
export function passwordStrength(password: string, context: PasswordContext = {}): PasswordStrength {
  if (password.length === 0) return { score: 0, label: "", hint: `Mindst ${MIN_PASSWORD_LENGTH} tegn. En lang sætning er bedre end et kort, kompliceret ord.` };
  const policyOk = validatePassword(password, { ...context, current: null }).length === 0;
  if (!policyOk) {
    return { score: password.length < MIN_PASSWORD_LENGTH ? 1 : 0, label: password.length < MIN_PASSWORD_LENGTH ? "For kort" : "For svag", hint: password.length < MIN_PASSWORD_LENGTH ? `Mangler ${MIN_PASSWORD_LENGTH - password.length} tegn.` : "Må ikke være almindelig, din e-mail eller dit navn." };
  }
  const classes = [/[a-zæøå]/, /[A-ZÆØÅ]/, /\d/, /[^A-Za-zÆØÅæøå\d]/].filter((re) => re.test(password)).length;
  if (password.length >= 20 || (password.length >= 16 && classes >= 3)) return { score: 3, label: "Stærk", hint: "God adgangskode." };
  if (password.length >= 14 || classes >= 3) return { score: 2, label: "Okay", hint: "Gør den længere for at gøre den stærkere." };
  return { score: 1, label: "Svag", hint: "Gør den længere, og bland gerne tegntyper." };
}
