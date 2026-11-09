/**
 * The agent, server-side.
 *
 * Deliberately the same shape as Val Town's "roll your own agent" template: a
 * while-loop over OpenAI chat completions with tool calls. The only tools are
 * document tools, so the model can only act on the document the user is
 * looking at — never anything else.
 *
 * `propose_edit` does not touch the document. It stages a replacement in a
 * pending-edit store keyed by editor slug; the browser polls for it and decides
 * how to apply it (one editor per demo, each applying through its own native
 * undo stack). That keeps writes auditable and undoable.
 */
import { OpenAI } from "https://esm.town/v/std/openai";

export interface PendingEdit {
  id: string;
  slug: string;
  /** Full replacement markdown for the document. */
  markdown: string;
  /** Short human summary of what changed. */
  summary: string;
  /** The user prompt that produced it. */
  prompt: string;
  createdAt: number;
}

const TTL_MS = 15 * 60 * 1000;

// Per-isolate pending edits. Vals scale to fresh isolates, so a poll may land
// elsewhere and see nothing; that's fine — the client falls back to a direct
// `POST /api/agent` response, and this is just the reconnect path.
const pending = new Map<string, PendingEdit[]>();

export function takePending(slug: string): PendingEdit[] {
  const now = Date.now();
  const all = (pending.get(slug) ?? []).filter((p) => now - p.createdAt < TTL_MS);
  pending.set(slug, all);
  return all;
}

export function pushPending(edit: PendingEdit) {
  const all = takePending(edit.slug);
  all.push(edit);
  pending.set(edit.slug, all.slice(-5));
}

const SYSTEM = `You are the editing agent inside a document editing demo.

The user is looking at a Word (.docx) document in an editor. The document is
provided to you as markdown. Answer questions about it, and when the user asks
for a change, call the propose_edit tool with the COMPLETE new document
markdown. Never return only a fragment — propose_edit replaces the document
wholesale.

Rules:
- Preserve the document's existing structure and voice unless asked otherwise.
- Keep markdown features simple: # / ## / ### headings, "- " bullets, plain
  paragraphs, **bold**, *italic*. No tables, HTML, or code fences.
- If the user only asks a question, answer in plain text without calling a tool.`;

const TOOLS = [{
  type: "function",
  function: {
    name: "propose_edit",
    description:
      "Propose the complete rewritten document. The user sees a diff and applies it to the editor.",
    parameters: {
      type: "object",
      properties: {
        markdown: {
          type: "string",
          description: "The full new document content in markdown.",
        },
        summary: {
          type: "string",
          description: "One sentence describing what changed (e.g. 'Shortened the risks section').",
        },
      },
      required: ["markdown", "summary"],
    },
  },
}];

export interface AgentResult {
  reply: string;
  edit?: { markdown: string; summary: string };
}

export async function runAgent(opts: {
  slug: string;
  document: string;
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const openai = new OpenAI();
  const messages: any[] = [
    { role: "system", content: SYSTEM },
    ...(opts.history ?? []).slice(-6),
    {
      role: "user",
      content:
        `Current document:\n\n<document>\n${opts.document.slice(0, 60_000)}\n</document>\n\nRequest: ${opts.prompt}`,
    },
  ];

  // A tool call means we want the edit, not a chat answer, so we allow at most
  // two round trips: propose → confirm.
  for (let turn = 0; turn < 3; turn++) {
    const res = await openai.chat.completions.create(
      { model: "gpt-4o-mini", messages, tools: TOOLS, temperature: 0.3 },
    );
    const msg = res.choices[0].message;
    messages.push(msg);

    const call = msg.tool_calls?.find((c) => c.function.name === "propose_edit");
    if (!call) return { reply: msg.content ?? "(no response)" };

    let args: { markdown?: string; summary?: string };
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: "Invalid JSON arguments; call propose_edit again with valid JSON.",
      });
      continue;
    }
    if (!args.markdown) {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: "Missing `markdown`; call propose_edit again with the full document.",
      });
      continue;
    }

    const edit = { markdown: args.markdown, summary: args.summary ?? "Updated the document" };
    pushPending({
      id: crypto.randomUUID(),
      slug: opts.slug,
      prompt: opts.prompt,
      createdAt: Date.now(),
      ...edit,
    });
    return { reply: edit.summary, edit };
  }

  return { reply: "The agent could not produce a usable edit." };
}
