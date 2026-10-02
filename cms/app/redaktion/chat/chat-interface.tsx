"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const PROMPT_CHIPS = [
  "Undersøg den seneste nyhed om klimaforandringer",
  "Skriv en manchet til en artikel om inflation",
  "Find vinkler på den politiske debat",
  "Hvad er de vigtigste spørgsmål at stille en kilde?",
];

export function ChatInterface({ sessionId, initialMessages, getContext }: {
  sessionId: string;
  initialMessages: Message[];
  /** Valgfri artikelkontekst (editor-docken): sendes med som data til /api/chat. Udeladt = uændret adfærd. */
  getContext?: () => Record<string, unknown> | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "auto">("ask");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // chat-module: rul kun ned, hvis brugeren allerede er nederst (ellers rykkes man midt i læsning af historik).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    nearBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text.trim(), mode, ...(getContext ? { context: getContext() } : {}) }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
            return copy;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Der opstod en fejl. Prøv igen." };
        return copy;
      });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="chat-shell">
      {empty ? (
        <div className="chat-empty">
          <Sparkles size={32} style={{ color: "var(--color-accent)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Hvad vil du undersøge?</h2>
          <p className="text-muted" style={{ marginBottom: 32, maxWidth: 440, textAlign: "center" }}>
            Stil et spørgsmål, undersøg en påstand, eller skriv en historie. Y finder kilderne og arbejder ved din side.
          </p>
          <div className="chat-chips">
            {PROMPT_CHIPS.map((chip) => (
              <button key={chip} className="chat-chip" onClick={() => send(chip)}>
                <Sparkles size={12} /> {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="chat-messages"
          ref={scrollRef}
          role="log"
          aria-label="Samtale"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
        >
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message chat-message-${msg.role}`}>
              <div className="chat-bubble">
                {msg.content || (loading && i === messages.length - 1 ? <Loader2 size={16} className="spin" /> : "")}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            placeholder="Beskriv en historie, en vinkel eller et spørgsmål…"
            rows={1}
            disabled={loading}
            aria-label="Besked"
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
            }}
          />
          <div className="chat-input-actions">
            <div className="seg">
              <label className="seg-opt">
                <input type="radio" name="mode" checked={mode === "ask"} onChange={() => setMode("ask")} />
                Spørg
              </label>
              <label className="seg-opt">
                <input type="radio" name="mode" checked={mode === "auto"} onChange={() => setMode("auto")} />
                Auto
              </label>
            </div>
            <button
              className="btn btn-primary btn-icon"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Send besked"
            >
              {loading ? <Loader2 size={16} className="spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
