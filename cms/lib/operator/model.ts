/**
 * Bagudkompatibel indgang: modelkontrakten og Anthropic-klienten ligger nu i ./llm/ (udbyder-abstraktion).
 * Nye kaldere bruger ./llm/* direkte; tests og ældre kode kan fortsat importere herfra.
 */
export type { LlmProvider, ModelContentBlock, ModelMessage, ModelRequest, ModelResponse, ModelToolResultBlock, OperatorModelClient, ProviderId } from "./llm/types";
export { createAnthropicOperatorClient } from "./llm/anthropic";
