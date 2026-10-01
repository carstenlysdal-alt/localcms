/**
 * Små byggesten til stabilitet: circuit breaker, backoff med jitter og et kald-med-timeout.
 * Ingen afhængigheder, ingen globale sideeffekter (tid og sleep kan injiceres i tests).
 */

export type BreakerState = "closed" | "open" | "half-open";

export type CircuitBreakerOptions = {
  /** Navn til log. */
  name: string;
  /** Antal fejl i træk før kredsløbet åbner. */
  failureThreshold?: number;
  /** Hvor længe kredsløbet er åbent før ét prøvekald (half-open). */
  openMs?: number;
  now?: () => number;
  /** Kaldes én gang når kredsløbet åbner/lukker (default: console.warn). Sæt til () => {} for stilhed. */
  onStateChange?: (name: string, state: BreakerState, detail?: string) => void;
};

export class CircuitOpenError extends Error {
  constructor(readonly breaker: string) {
    super(`Kredsløbet "${breaker}" er åbent.`);
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: BreakerState = "closed";
  private probing = false;
  private lastNotified: BreakerState = "closed";
  private readonly threshold: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.threshold = options.failureThreshold ?? 3;
    this.openMs = options.openMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  get name() {
    return this.options.name;
  }

  /** Aktuel tilstand (opdaterer open -> half-open når ventetiden er gået). */
  getState(): BreakerState {
    if (this.state === "open" && this.now() - this.openedAt >= this.openMs) this.state = "half-open";
    return this.state;
  }

  /** True når kald skal afvises (åben, eller et prøvekald allerede er i gang). */
  isOpen(): boolean {
    const state = this.getState();
    if (state === "open") return true;
    if (state === "half-open") return this.probing;
    return false;
  }

  /** Kald før et forsøg. Returnerer false hvis kaldet skal springes over. */
  tryAcquire(): boolean {
    const state = this.getState();
    if (state === "closed") return true;
    if (state === "half-open" && !this.probing) {
      this.probing = true;
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    this.probing = false;
    this.state = "closed";
    this.notify("closed", "genoprettet");
  }

  recordFailure(error?: unknown) {
    this.probing = false;
    this.failures += 1;
    if (this.state === "half-open" || this.failures >= this.threshold) {
      this.state = "open";
      this.openedAt = this.now();
      this.notify("open", error instanceof Error ? error.message : undefined);
    }
  }

  reset() {
    this.failures = 0;
    this.probing = false;
    this.state = "closed";
  }

  /** Kør fn bag kredsløbet. Kaster CircuitOpenError uden at kalde fn når åbent. */
  async exec<T>(fn: () => Promise<T>, countsAsFailure: (error: unknown) => boolean = () => true): Promise<T> {
    if (!this.tryAcquire()) throw new CircuitOpenError(this.name);
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      // Klientfejl (fx 400) betyder at tjenesten svarer: tæl ikke som nedbrud.
      if (countsAsFailure(error)) this.recordFailure(error);
      else this.recordSuccess();
      throw error;
    }
  }

  /** Logger kun ved reelle skift (åben <-> lukket), ikke ved hvert mislykket prøvekald. */
  private notify(state: BreakerState, detail?: string) {
    if (state === this.lastNotified) return;
    this.lastNotified = state;
    const handler =
      this.options.onStateChange ??
      ((name: string, s: BreakerState, d?: string) => {
        console.warn(`[resilience] kredsløb "${name}" -> ${s}${d ? ` (${d})` : ""}`);
      });
    try {
      handler(this.name, state, detail);
    } catch {
      /* log må aldrig vælte kaldet */
    }
  }
}

/** Eksponentiel backoff med fuld jitter. attempt starter ved 1. */
export function backoffDelay(attempt: number, baseMs = 300, maxMs = 5_000, random: () => number = Math.random): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * ceiling);
}

export class TimeoutError extends Error {
  constructor(readonly ms: number, label = "kald") {
    super(`${label} overskred ${ms} ms.`);
    this.name = "TimeoutError";
  }
}

/** Race fn mod en timeout; afbryder via AbortSignal hvis fn bruger det. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, label?: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms, label));
    }, ms);
  });
  const call = fn(controller.signal);
  call.catch(() => undefined);
  try {
    return await Promise.race([call, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const globalForBreakers = globalThis as unknown as { __breakers?: Map<string, CircuitBreaker> };

/** Delt, navngivet breaker pr. proces (fx "anthropic"), så alle kaldere deler tilstand. */
export function getBreaker(name: string, options: Omit<CircuitBreakerOptions, "name"> = {}): CircuitBreaker {
  const map = (globalForBreakers.__breakers ??= new Map());
  let breaker = map.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker({ name, ...options });
    map.set(name, breaker);
  }
  return breaker;
}

/** Fejl der IKKE skal tælle mod kredsløbet (klientfejl 4xx undtagen 408/429). */
export function isBreakerFailure(error: unknown): boolean {
  if (error instanceof CircuitOpenError) return false;
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return true;
}
