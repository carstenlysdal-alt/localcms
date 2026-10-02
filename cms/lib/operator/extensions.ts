/**
 * Udvidelsespunkt for AI-operatørens værktøjer.
 *
 * Kommende moduler (LocalRating: opret feed/kilde, opret kandidat, kør rating, generér udkast, opret udgivelsesplan,
 * opret prompt-version; redaktions-editoren: sæt metadata, opslagstekster …) lægger deres værktøjer i en egen fil, der
 * kalder `registerTool(defineTool({...}))`, og importeres her med én linje:
 *
 *   import "./tools/localrating";
 *
 * Intet andet i orkestreringen skal ændres. Se docs/review/FIX-ai-operator.md ("Sådan tilføjer du et værktøj").
 */
import "./tools/article-meta";

export {};
