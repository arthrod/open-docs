/**
 * The document agent, server-side.
 *
 * Same shape as Val Town's "roll your own agent" template: a chat-completions
 * loop with tool calls, through `std/openai` (Val Town's OpenAI proxy — the
 * val's own token, nothing to configure). The only tool edits the document the
 * user has open, so the model can act on that document and nothing else.
 *
 * The browser sends the document as markdown and applies the returned edit
 * through the editor's own API (see lib/ui.ts → adapter.applyMarkdown).
 */
import { OpenAI } from "https://esm.town/v/std/openai";

/** What we ask the proxy for. It may route to a newer model; we report what answered. */
export const AGENT_MODEL = "gpt-5.6-luna";

const SYSTEM = `You are the writing assistant built into a word processor.

The user has a Word (.docx) document open. You receive it as markdown inside
<document> tags. You can talk with the user, and you can CHANGE the document by
calling the edit_document tool.

When the user asks for any change — write, draft, rewrite, shorten, expand,
translate, restructure, fix, format, add or remove content — call
edit_document with the COMPLETE new document. It replaces the whole document,
so include every part you are keeping, not just the changed part.

If the document is empty and the user asks you to write something, write it
and call edit_document. If the user only asks a question about the document,
answer in plain text and do not call the tool.

Markdown you may use (the editors understand exactly these):
- "# " title, "## " heading, "### " sub-heading
- "- " bullet items (indent two spaces per nesting level)
- blank line between paragraphs
- **bold** and *italic* inside a line
Do not use tables, links, images, HTML, numbered lists or code fences.

Keep the author's voice and existing structure unless asked otherwise. In the
tool's summary, say in one short sentence what you changed.`;

const TOOLS = [{
  type: "function" as const,
  function: {
    name: "edit_document",
    description:
      "Replace the open document with new content. Use for every requested change. The editor applies it immediately and the user can undo.",
    parameters: {
      type: "object",
      properties: {
        markdown: {
          type: "string",
          description: "The full new document, in the limited markdown described in the instructions.",
        },
        summary: {
          type: "string",
          description: "One short sentence describing the change, e.g. 'Shortened the risks section to three bullets'.",
        },
      },
      required: ["markdown", "summary"],
      additionalProperties: false,
    },
  },
}];

export interface AgentResult {
  reply: string;
  model?: string;
  edit?: { markdown: string; summary: string };
}

type Msg = Record<string, unknown>;

/**
 * One completion. gpt-5.6-luna is a reasoning model, and Val Town's proxy
 * rejects function tools unless reasoning is off ("Function tools with
 * reasoning_effort are not supported…"), so ask for that up front.
 */
async function complete(openai: OpenAI, messages: Msg[]) {
  return await openai.chat.completions.create({
    model: AGENT_MODEL,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    reasoning_effort: "none",
  } as any);
}

export async function runAgent(opts: {
  slug: string;
  document: string;
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AgentResult> {
  const openai = new OpenAI();
  const history = (opts.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const doc = opts.document.trim() ? opts.document.slice(0, 60_000) : "(the document is empty)";
  const messages: Msg[] = [
    { role: "system", content: SYSTEM },
    ...history,
    {
      role: "user",
      content: `<document>\n${doc}\n</document>\n\n${opts.prompt}`,
    },
  ];

  let model: string | undefined;
  for (let turn = 0; turn < 3; turn++) {
    const res = await complete(openai, messages);
    model = (res as any).model ?? model;
    const msg = res.choices[0].message as any;
    messages.push(msg);

    const call = msg.tool_calls?.find((c: any) => c.function?.name === "edit_document");
    if (!call) return { reply: msg.content?.trim() || "(no response)", model };

    let args: { markdown?: string; summary?: string } = {};
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: "The arguments were not valid JSON. Call edit_document again with valid JSON.",
      });
      continue;
    }
    if (!args.markdown?.trim()) {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: "`markdown` was empty. Call edit_document again with the complete document.",
      });
      continue;
    }
    const summary = args.summary?.trim() || "Updated the document";
    return {
      reply: [msg.content?.trim(), summary].filter(Boolean).join("\n\n"),
      model,
      edit: { markdown: args.markdown, summary },
    };
  }
  return { reply: "I couldn't produce a usable edit — try rephrasing the request.", model };
}
