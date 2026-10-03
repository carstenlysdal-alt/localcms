"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Check, CheckCircle2, Copy, Loader2, Mic, Send, ShieldCheck, Square, Undo2, XCircle } from "lucide-react";
import type { CapabilityGroup } from "@/lib/operator/capabilities";
import type { ProviderInfo } from "@/lib/operator/llm/types";
import { Markdown } from "./markdown";
import { initialState, plainTranscript, reduce, type Item } from "./reducer";
import { collectTranscript, getSpeechRecognition, mergeDictation, SPEECH_UNSUPPORTED, speechErrorMessage, type SpeechRecognitionLike } from "./speech";
import { readEventStream } from "./stream";
import "./operator.css";

const SUGGESTIONS = [
  { label: "Opret standardsektioner", text: "Opret sektionerne Nyheder, Erhverv, Sport, Kultur, Foreningsliv og Debat" },
  { label: "Vis ulæste signaler", text: "Vis de seneste ulæste signaler" },
  { label: "Hvad kan du?", text: "Hvad kan du hjælpe mig med?" },
];

const MAX_INPUT = 2000;
const NEAR_BOTTOM_PX = 100;

function CopyButton({ text, label = "Kopiér svar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard kan være blokeret */
    }
  }
  return (
    <button type="button" className="op-icon-btn" onClick={copy} aria-label={copied ? "Kopieret" : label} title={copied ? "Kopieret" : label}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

function minutesLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

/** Lille note når en ekstern udbyder (DeepSeek) er aktiv: persondata maskeres, før noget sendes. */
export function ProviderNotice({ provider }: { provider: ProviderInfo | null | undefined }) {
  if (!provider?.minimiseData) return null;
  return (
    <p className="op-provider-note" role="note">
      <ShieldCheck size={13} aria-hidden="true" /> Bruger {provider.label} — persondata maskeres før de sendes
    </p>
  );
}

export function OperatorSurface({ capabilities, roleName, provider = null, variant, active = true }: { capabilities: CapabilityGroup[]; roleName: string; provider?: ProviderInfo | null; variant: "panel" | "page"; active?: boolean }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [input, setInput] = useState("");
  const [announce, setAnnounce] = useState("");
  const [listening, setListening] = useState(false);
  const [speechNote, setSpeechNote] = useState("");
  const [showJump, setShowJump] = useState(false);
  const sessionRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const confirmRefs = useRef(new Map<string, HTMLDivElement>());
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    sessionRef.current = `op_${crypto.randomUUID().replace(/-/g, "")}`;
    const ctor = getSpeechRecognition(window as unknown as Parameters<typeof getSpeechRecognition>[0]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechSupported(Boolean(ctor));
    return () => {
      abortRef.current?.abort();
      recogRef.current?.abort();
    };
  }, []);

  // Auto-scroll kun hvis brugeren allerede er nederst (rykker ikke rundt midt i læsning).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
    else if (state.streaming) setShowJump(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [state.items, state.streaming]);

  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    if (near) setShowJump(false);
  }, []);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = true;
    el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function send(raw: string, retry = false) {
    const text = raw.trim();
    if (!text || state.streaming) return;
    stopListening();
    nearBottomRef.current = true;
    dispatch({ type: "send", text, retry });
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const controller = new AbortController();
    abortRef.current = controller;
    setAnnounce("AI-operatøren arbejder");
    try {
      const res = await fetch("/api/operator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sessionRef.current, message: text }), signal: controller.signal });
      if (!res.ok || !res.body) {
        let message = "Der opstod en fejl. Prøv igen.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* ingen JSON */
        }
        dispatch({ type: "fail", message });
        return;
      }
      let sawDone = false;
      await readEventStream(res.body, (event) => {
        if (event.type === "done") sawDone = true;
        if (event.type === "tool_result") setAnnounce(`${event.ok ? "Udført" : "Fejlede"}: ${event.summary}`);
        if (event.type === "confirm_required") setAnnounce(`Kræver din bekræftelse: ${event.summary}`);
        if (event.type === "error") setAnnounce(event.message);
        dispatch({ type: "event", event });
      });
      if (!sawDone) dispatch({ type: "abort" });
      else setAnnounce("Svaret er færdigt");
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") dispatch({ type: "abort" });
      else dispatch({ type: "fail", message: "Forbindelsen blev afbrudt. Prøv igen." });
    } finally {
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  async function answerConfirm(token: string, action: "apply" | "cancel") {
    if (action === "apply") dispatch({ type: "confirm_start", token });
    try {
      const res = await fetch("/api/operator/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action }) });
      const body = (await res.json()) as { ok?: boolean; summary?: string; message?: string; code?: string; undoId?: string | null; undoLabel?: string | null; secret?: { label: string; value: string } | null };
      if (action === "cancel") {
        dispatch({ type: "confirm_done", token, status: "cancelled", message: "Annulleret. Intet er ændret." });
        setAnnounce("Handlingen er annulleret");
        return;
      }
      if (!res.ok) {
        dispatch({ type: "confirm_done", token, status: body.code === "udloebet" ? "expired" : "error", message: body.message ?? "Handlingen kunne ikke udføres." });
        setAnnounce(body.message ?? "Handlingen kunne ikke udføres.");
        return;
      }
      dispatch({ type: "confirm_done", token, status: body.ok ? "applied" : "error", message: body.summary, secret: body.secret ?? null, undo: body.undoId ? { undoId: body.undoId, label: body.undoLabel ?? "Fortryd" } : null });
      setAnnounce(`${body.ok ? "Udført" : "Fejlede"}: ${body.summary ?? ""}`);
    } catch {
      dispatch({ type: "confirm_done", token, status: "error", message: "Forbindelsen blev afbrudt. Tjek siden, før du prøver igen." });
    }
  }

  async function runUndo(undoId: string) {
    dispatch({ type: "undo_start", undoId });
    try {
      const res = await fetch("/api/operator/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ undoId }) });
      const body = (await res.json()) as { ok?: boolean; summary?: string; message?: string; partial?: boolean };
      const ok = Boolean(res.ok && body.ok && !body.partial);
      dispatch({ type: "undo_done", undoId, ok, message: body.summary ?? body.message ?? "Fortryd mislykkedes." });
      setAnnounce(body.summary ?? body.message ?? "");
    } catch {
      dispatch({ type: "undo_done", undoId, ok: false, message: "Forbindelsen blev afbrudt." });
    }
  }

  // ── Tale ──────────────────────────────────────────────────────────────────
  function stopListening() {
    recogRef.current?.stop();
  }

  function toggleMic() {
    if (listening) {
      stopListening();
      return;
    }
    const ctor = getSpeechRecognition(window as unknown as Parameters<typeof getSpeechRecognition>[0]);
    if (!ctor) {
      setSpeechNote(SPEECH_UNSUPPORTED);
      return;
    }
    setSpeechNote("");
    const recog = new ctor();
    recog.lang = "da-DK";
    recog.continuous = true;
    recog.interimResults = true;
    baseRef.current = input;
    recog.onresult = (event) => {
      const { final, interim } = collectTranscript(event.results);
      const next = mergeDictation(baseRef.current, `${final} ${interim}`);
      setInput(next.slice(0, MAX_INPUT));
      requestAnimationFrame(() => textareaRef.current && resize(textareaRef.current));
    };
    recog.onerror = (event) => setSpeechNote(speechErrorMessage(event.error));
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
      textareaRef.current?.focus();
      setAnnounce("Mikrofonen er slukket. Teksten kan redigeres, før du sender.");
    };
    try {
      recog.start();
      recogRef.current = recog;
      setListening(true);
      setAnnounce("Lytter. Tal nu.");
    } catch {
      setSpeechNote("Mikrofonen kunne ikke startes. Prøv igen.");
    }
  }

  // Flyt fokus til nyt bekræftelseskort, så skærmlæsere og tastaturbrugere opdager det.
  const lastPending = [...state.items].reverse().find((i): i is Extract<Item, { kind: "confirm" }> => i.kind === "confirm" && i.status === "pending");
  const lastPendingId = lastPending?.id;
  useEffect(() => {
    if (lastPendingId) confirmRefs.current.get(lastPendingId)?.focus();
  }, [lastPendingId]);

  const empty = state.items.length === 0;
  const lastAssistantStreaming = state.items.some((i) => i.kind === "assistant" && i.streaming);

  return (
    <div className={`op-surface op-${variant}`}>
      <details className="op-caps">
        <summary>
          <ShieldCheck size={14} aria-hidden="true" /> Hvad må AI for dig? <span className="op-caps-role">({roleName})</span>
        </summary>
        <div className="op-caps-body">
          {provider && (
            <p>
              <strong>Udbyder:</strong> {provider.label} ({provider.model}).{" "}
              {provider.minimiseData ? "E-mail, telefonnumre, CPR-lignende numre og kontaktfelter (indsendere, brugere, kilder) maskeres eller udelades, før noget sendes. Skriv ikke personoplysninger i dine beskeder, hvis det kan undgås." : "Data behandles hos udbyderen efter aftale."}
            </p>
          )}
          <p>AI-operatøren kan kun det, du selv har rettighed til. Publicering, afsendelse, betaling, sletning af brugere og ændring af adgangskoder eller roller sker aldrig via AI; du gør det selv på den relevante side.</p>
          {capabilities.length === 0 ? (
            <p>Din rolle har ingen handlinger, som AI kan udføre for dig.</p>
          ) : (
            <ul className="op-caps-list">
              {capabilities.map((group) => (
                <li key={group.category}>
                  <strong>{group.category}</strong>
                  <ul>
                    {group.tools.map((tool) => (
                      <li key={tool.name}>
                        <span className={`op-risk op-risk-${tool.risk}`}>{tool.risk === "read" ? "læser" : tool.risk === "safe-write" ? "kan fortrydes" : "kræver bekræftelse"}</span> {tool.hint}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <div className="op-scroll-wrap">
        <div ref={scrollRef} className="op-scroll" onScroll={onScroll} role="log" aria-label="Samtale med AI-operatøren" aria-live={state.streaming ? "off" : "polite"} aria-relevant="additions" tabIndex={0}>
          {empty && (
            <div className="op-empty">
              <h2 className="op-empty-title">Hvad skal jeg gøre for dig?</h2>
              <p>Skriv eller tal. Jeg kan oprette sektioner, områder, emner, kladder og signaler, og jeg viser altid, hvad der er sket. Det meste kan fortrydes.</p>
              <div className="op-chips" role="group" aria-label="Forslag">
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} type="button" className="op-chip" onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.items.map((item) => (
            <ItemView key={item.id} item={item} confirmRef={(el) => { if (el) confirmRefs.current.set(item.id, el); else confirmRefs.current.delete(item.id); }} onConfirm={answerConfirm} onUndo={runUndo} onRetry={(text) => send(text, true)} onDismissSecret={(token) => dispatch({ type: "dismiss_secret", token })} busy={state.streaming} />
          ))}
          {state.streaming && !lastAssistantStreaming && (
            <div className="op-typing" role="status">
              <span className="op-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="op-typing-text">AI-operatøren arbejder…</span>
            </div>
          )}
        </div>
        {showJump && (
          <button type="button" className="op-jump" onClick={jumpToBottom}>
            <ArrowDown size={14} aria-hidden="true" /> Nyt svar
          </button>
        )}
      </div>

      <div className="op-sr-only" role="status" aria-live="polite">{announce}</div>

      <form className="op-form" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        {listening && (
          <div className="op-listening" role="status">
            <span className="op-rec-dot" aria-hidden="true" /> Lytter… tal nu. Tryk på mikrofonen for at stoppe, og ret teksten, før du sender.
          </div>
        )}
        {speechNote && <p className="op-note" role="alert">{speechNote}</p>}
        <div className="op-input-row">
          <label htmlFor={`op-input-${variant}`} className="op-sr-only">Besked til AI-operatøren</label>
          <textarea
            id={`op-input-${variant}`}
            ref={textareaRef}
            className="op-textarea"
            rows={1}
            value={input}
            maxLength={MAX_INPUT}
            disabled={state.streaming}
            placeholder={listening ? "Lytter…" : "Skriv eller tal en opgave, fx ‘Opret sektionen Sport’"}
            onChange={(e) => { setInput(e.target.value); resize(e.target); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button type="button" className={`op-btn op-mic${listening ? " op-mic-on" : ""}`} onClick={toggleMic} aria-pressed={listening} disabled={state.streaming || !speechSupported} aria-label={listening ? "Stop mikrofon" : "Tal til AI-operatøren"} title={speechSupported ? (listening ? "Stop mikrofon" : "Tal (dansk)") : SPEECH_UNSUPPORTED}>
            <Mic size={18} aria-hidden="true" />
          </button>
          {state.streaming ? (
            <button type="button" className="op-btn op-stop" onClick={() => abortRef.current?.abort()} aria-label="Stop svar">
              <Square size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="op-btn op-send" disabled={!input.trim()} aria-label="Send">
              <Send size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="op-hint">
          Enter sender, Shift+Enter giver linjeskift.{!speechSupported ? ` ${SPEECH_UNSUPPORTED}` : " Tale behandles af din browser; der sendes ingen lyd til os."}
          {state.items.some((i) => i.kind === "assistant") && <> <CopyButton text={plainTranscript(state.items)} label="Kopiér alle svar" /></>}
        </p>
      </form>
    </div>
  );
}

function ItemView({ item, confirmRef, onConfirm, onUndo, onRetry, onDismissSecret, busy }: {
  item: Item;
  confirmRef: (el: HTMLDivElement | null) => void;
  onConfirm: (token: string, action: "apply" | "cancel") => void;
  onUndo: (undoId: string) => void;
  onRetry: (text: string) => void;
  onDismissSecret: (token: string) => void;
  busy: boolean;
}) {
  switch (item.kind) {
    case "user":
      return (
        <div className="op-msg op-user">
          <p>{item.text}</p>
          {item.status === "error" && <span className="op-note">Beskeden kunne ikke sendes.</span>}
        </div>
      );
    case "assistant":
      return (
        <div className="op-msg op-assistant">
          <Markdown text={item.text} />
          {item.streaming ? <span className="op-caret" aria-hidden="true" /> : <div className="op-msg-actions"><CopyButton text={item.text} /></div>}
        </div>
      );
    case "tool":
      return (
        <div className={`op-tool op-tool-${item.status}`}>
          {item.status === "running" ? <Loader2 size={14} className="op-spin" aria-hidden="true" /> : item.status === "ok" ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
          <span>
            {item.status === "running" ? `Arbejder: ${item.summary}` : item.status === "ok" ? `Udført: ${item.resultSummary ?? item.summary}` : `Fejlede: ${item.resultSummary ?? item.summary}`}
          </span>
        </div>
      );
    case "confirm":
      return (
        <div ref={confirmRef} tabIndex={-1} className={`op-confirm op-confirm-${item.status}`} role="group" aria-label={`Bekræft: ${item.summary}`}>
          <div className="op-confirm-head">
            <span className="op-risk op-risk-confirm"><AlertTriangle size={13} aria-hidden="true" /> Kræver din bekræftelse</span>
            <strong>{item.summary}</strong>
          </div>
          <ul className="op-confirm-details">{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
          {item.status === "pending" && (
            <>
              <p className="op-confirm-meta">Gyldig i cirka {minutesLeft(item.expiresAt)} min. Intet sker, før du trykker Anvend.</p>
              <div className="op-confirm-actions">
                <button type="button" className="op-btn op-apply" onClick={() => onConfirm(item.token, "apply")}>Anvend</button>
                <button type="button" className="op-btn op-cancel" onClick={() => onConfirm(item.token, "cancel")}>Annullér</button>
              </div>
            </>
          )}
          {item.status === "applying" && <p className="op-confirm-meta" role="status"><Loader2 size={14} className="op-spin" aria-hidden="true" /> Udfører…</p>}
          {(item.status === "applied" || item.status === "cancelled" || item.status === "error" || item.status === "expired") && <p className={`op-confirm-result op-confirm-${item.status}`} role="status">{item.status === "applied" ? "Udført: " : ""}{item.message}</p>}
          {item.secret && (
            <div className="op-secret" role="note">
              <p><strong>{item.secret.label}</strong> (vises kun nu, og gemmes ikke):</p>
              <code>{item.secret.value}</code> <CopyButton text={item.secret.value} label="Kopiér adgangskode" />
              <button type="button" className="op-link" onClick={() => onDismissSecret(item.token)}>Skjul</button>
            </div>
          )}
        </div>
      );
    case "undo":
      return (
        <div className="op-undo">
          {item.status === "available" || item.status === "working" ? (
            <button type="button" className="op-btn op-undo-btn" disabled={item.status === "working" || busy} onClick={() => onUndo(item.undoId)}>
              {item.status === "working" ? <Loader2 size={14} className="op-spin" aria-hidden="true" /> : <Undo2 size={14} aria-hidden="true" />} {item.label}
            </button>
          ) : (
            <p className={`op-note op-undo-${item.status}`} role="status">{item.status === "done" ? "Fortrudt: " : "Fortryd mislykkedes: "}{item.message}</p>
          )}
        </div>
      );
    case "error":
      return (
        <div className="op-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> <span>{item.message}</span>
          {item.retryText && <button type="button" className="op-link" disabled={busy} onClick={() => onRetry(item.retryText!)}>Prøv igen</button>}
        </div>
      );
  }
}
