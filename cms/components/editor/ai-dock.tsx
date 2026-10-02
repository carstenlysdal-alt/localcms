"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ChatInterface } from "@/app/redaktion/chat/chat-interface";
import { EditorBridgeProvider, useArticleChatContext } from "./editor-bridge";

type Message = { role: "user" | "assistant"; content: string };

function Dock({ sessionId, initialMessages, children }: { sessionId: string; initialMessages: Message[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const getArticleContext = useArticleChatContext();
  return (
    <div className="ai-dock-layout">
      <div className="ai-dock-content">{children}</div>
      {open && (
        <aside className="ai-dock-panel" aria-label="AI-assistent">
          <div className="ai-dock-header">
            <span className="ai-dock-title"><Sparkles size={14} /> AI-assistent</span>
            <button className="btn btn-icon btn-ghost" onClick={() => setOpen(false)} aria-label="Luk"><X size={16} /></button>
          </div>
          <div className="ai-dock-body">
            {/* Samme chat-komponent som AI-operatøren; artikelkonteksten følger med hver besked. */}
            <ChatInterface sessionId={sessionId} initialMessages={initialMessages} getContext={getArticleContext} />
          </div>
        </aside>
      )}
      <button
        className="ai-dock-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Skjul AI-assistent" : "Vis AI-assistent"}
        hidden={open}
      >
        <Sparkles size={16} /> AI-assistent
      </button>
    </div>
  );
}

/** AI-dock (chat) til artikelsider: også på /artikler/ny. Giver chatten artiklens aktuelle titel, underrubrik, brødtekst, sektion, geo og tags. */
export function AiDock(props: { sessionId: string; initialMessages: Message[]; children: React.ReactNode }) {
  return (
    <EditorBridgeProvider>
      <Dock {...props} />
    </EditorBridgeProvider>
  );
}
