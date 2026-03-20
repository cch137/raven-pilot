import fs from "fs/promises";
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
  START,
  END,
  Messages,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { AIMessageChunk, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import dotenv from "dotenv";
import { app, registerStaticAssets, startServers } from "./server";
import { createToolkit, type ToolkitTool } from "./toolkits";
import { stringifyError } from "./utils/errors";
import { resolvePathFromBase } from "./utils/paths";

dotenv.config();

const AGENT_SYSTEM_PROMPT_URL = new URL(
  "./prompts/agent-system.md",
  import.meta.url,
);
let agentSystemPromptPromise: Promise<string> | null = null;

async function getAgentSystemPrompt() {
  if (!agentSystemPromptPromise) {
    agentSystemPromptPromise = fs
      .readFile(AGENT_SYSTEM_PROMPT_URL, "utf-8")
      .then((content) => content.trim());
  }

  return agentSystemPromptPromise;
}

type ConversationRole = "user" | "assistant" | "system" | "tool";
type MessageKind = "message" | "thinking" | "tool-call" | "tool-result";

type ConversationMessage = {
  id: string;
  role: ConversationRole;
  kind: MessageKind;
  title?: string;
  content: string;
  createdAt: string;
  groupId?: string;
};

type ConversationSnapshot = {
  threadId: string;
  cwd: string;
  processing: boolean;
  messages: ConversationMessage[];
};

type StreamEvent =
  | { type: "snapshot"; data: ConversationSnapshot }
  | { type: "message-added"; data: ConversationMessage }
  | { type: "message-updated"; data: ConversationMessage }
  | { type: "conversation-reset"; data: ConversationSnapshot }
  | { type: "processing"; data: { processing: boolean } };

type QueueItem = {
  content: string;
  cwd: string;
};

class AgentRuntime {
  private readonly subscribers = new Set<(event: StreamEvent) => void>();
  private readonly queue: QueueItem[] = [];
  private readonly checkpointer = new MemorySaver();
  private readonly graphs = new Map<string, any>();
  private processing = false;
  private threadId = crypto.randomUUID();
  private messages: ConversationMessage[] = [];
  private queueRunning = false;
  private threadInitialized = false;
  private CWD = process.cwd();

  subscribe(listener: (event: StreamEvent) => void) {
    this.subscribers.add(listener);
    listener({ type: "snapshot", data: this.snapshot() });
    return () => {
      this.subscribers.delete(listener);
    };
  }

  snapshot(): ConversationSnapshot {
    return {
      threadId: this.threadId,
      cwd: this.CWD,
      processing: this.processing,
      messages: [...this.messages],
    };
  }

  async setCWD(nextPath: string) {
    const resolved = resolvePathFromBase(this.CWD, nextPath);
    const stat = await fs.stat(resolved);

    if (!stat.isDirectory()) {
      throw new Error(`CWD must be a directory: ${resolved}`);
    }

    if (resolved === this.CWD) return resolved;

    this.CWD = resolved;
    this.broadcast({ type: "snapshot", data: this.snapshot() });
    return resolved;
  }

  async enqueueUserMessage(content: string, cwd = this.CWD) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");
    if (trimmed === "/reset") {
      this.resetConversation();
      return;
    }

    this.queue.push({ content: trimmed, cwd });
    this.runQueue().catch((error) => {
      console.error("Queue processing failed", error);
    });
  }

  resetConversation() {
    this.queue.length = 0;
    this.processing = false;
    this.threadId = crypto.randomUUID();
    this.messages = [];
    this.threadInitialized = false;
    this.broadcast({ type: "conversation-reset", data: this.snapshot() });
    this.addMessage("system", "message", "New conversation started.", "System");
    this.broadcast({ type: "processing", data: { processing: false } });
  }

  private getGraph(cwd: string) {
    const cached = this.graphs.get(cwd);
    if (cached) return cached;

    const toolkit = createToolkit(cwd);
    const tools = toolkit.tools.map((toolDef) => this.wrapTool(toolDef));
    const model = new ChatOpenAI("gpt-5.4", {
      apiKey: process.env["OPENAI_API_KEY"],
      reasoning: { effort: "high", summary: "detailed" },
      verbosity: "low",
    }).bindTools(tools);

    const callModel = async (state: typeof MessagesAnnotation.State) => {
      const stream = await model.stream(state.messages);
      let full: AIMessageChunk | null = null;
      let assistantMessageId: string | null = null;
      let thinkingMessageId: string | null = null;

      for await (const chunk of stream) {
        full = full ? full.concat(chunk) : chunk;

        const answerText = chunk.text ?? "";
        if (answerText) {
          assistantMessageId ??= this.addMessage(
            "assistant",
            "message",
            "",
            "Answer",
          ).id;
          this.appendToMessage(assistantMessageId, answerText);
        }

        const thinkingText = extractThinkingText(chunk);
        if (thinkingText) {
          thinkingMessageId ??= this.addMessage(
            "assistant",
            "thinking",
            "",
            "Thinking",
          ).id;
          this.appendToMessage(thinkingMessageId, thinkingText);
        }
      }

      return { messages: full ? [full] : [] };
    };

    const specialToolHandler = (state: typeof MessagesAnnotation.State) => {
      const messages: Messages = [];

      for (const message of state.messages) {
        if (!ToolMessage.isInstance(message)) continue;
        if (!message.id) message.id = crypto.randomUUID();
        const part = toolkit.getImagePart(message.text);
        if (!part) continue;
        messages.push({
          role: "human",
          content: [{ type: "image_url", image_url: { url: part.url } }],
        });
      }

      return { messages };
    };

    const graph = new StateGraph(MessagesAnnotation)
      .addNode("agent", callModel)
      .addNode("tools", new ToolNode(tools))
      .addNode("toolHandler", specialToolHandler)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", toolsCondition, {
        tools: "tools",
        __end__: END,
      })
      .addEdge("tools", "toolHandler")
      .addEdge("toolHandler", "agent")
      .compile({ checkpointer: this.checkpointer });

    this.graphs.set(toolkit.cwd, graph);
    return graph;
  }

  private wrapTool(toolDef: ToolkitTool) {
    return tool(
      async (input) => {
        const groupId = crypto.randomUUID();

        this.addMessage(
          "tool",
          "tool-call",
          formatToolCall(toolDef.name, input),
          `Tool Call: ${toolDef.name}`,
          groupId,
        );

        const result = await toolDef.invoke(input);
        const text = stringifyValue(result);

        this.addMessage(
          "tool",
          "tool-result",
          text,
          `Tool Result: ${toolDef.name}`,
          groupId,
        );

        return result;
      },
      {
        name: toolDef.name,
        description: toolDef.description,
        schema: toolDef.schema,
      },
    );
  }

  private async runQueue() {
    if (this.queueRunning) return;
    this.queueRunning = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;
        await this.processUserMessage(item.content, item.cwd);
      }
    } finally {
      this.queueRunning = false;
    }
  }

  private async processUserMessage(input: string, cwd: string) {
    const includeAgentSystemPrompt = !this.threadInitialized;

    this.addMessage("user", "message", input, "User");
    this.setProcessing(true);

    try {
      const graph = this.getGraph(cwd);
      const systemMessages = includeAgentSystemPrompt
        ? [{ role: "system" as const, content: await getAgentSystemPrompt() }]
        : [];

      const stream = await graph.stream(
        {
          messages: [
            ...systemMessages,
            {
              role: "system",
              content:
                `Runtime working directory (CWD): ${cwd}\n` +
                "Resolve every relative path for tool usage from this directory.",
            },
            { role: "user", content: input },
          ],
        },
        {
          configurable: { thread_id: this.threadId },
          subgraphs: true,
          streamMode: ["updates", "values"],
          recursionLimit: 1_000_000,
        },
      );

      for await (const [_subgraphs, _mode, _chunk] of stream) {
        // consume the stream to drive incremental updates
      }

      this.threadInitialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addMessage("system", "message", `Error: ${message}`, "System");
    } finally {
      this.setProcessing(false);
    }
  }

  private setProcessing(processing: boolean) {
    this.processing = processing;
    this.broadcast({ type: "processing", data: { processing } });
  }

  private addMessage(
    role: ConversationRole,
    kind: MessageKind,
    content: string,
    title?: string,
    groupId?: string,
  ): ConversationMessage {
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      role,
      kind,
      title,
      content,
      createdAt: new Date().toISOString(),
      groupId,
    };
    this.messages = [...this.messages, message];
    this.broadcast({ type: "message-added", data: message });
    return message;
  }

  private appendToMessage(id: string, delta: string) {
    let updated: ConversationMessage | null = null;
    this.messages = this.messages.map((message) => {
      if (message.id !== id) return message;
      updated = { ...message, content: message.content + delta };
      return updated;
    });
    if (updated) {
      this.broadcast({ type: "message-updated", data: updated });
    }
  }

  private broadcast(event: StreamEvent) {
    for (const subscriber of this.subscribers) subscriber(event);
  }
}

function formatToolCall(name: string, input: unknown) {
  return `${name}(${safePrettyJson(input)})`;
}

function safePrettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value;
  return safePrettyJson(value);
}

function extractThinkingText(chunk: AIMessageChunk): string {
  const visited = new Set<string>();
  const parts: string[] = [];

  const visit = (value: unknown) => {
    if (value == null) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const type =
      typeof record.type === "string" ? record.type.toLowerCase() : "";
    const textCandidates = [
      record.text,
      record.summary,
      record.content,
      record.reasoning,
    ];

    if (
      type.includes("reason") ||
      type.includes("thinking") ||
      type.includes("summary")
    ) {
      for (const candidate of textCandidates) {
        const text = flattenText(candidate);
        if (!text) continue;
        if (visited.has(text)) continue;
        visited.add(text);
        parts.push(text);
      }
    }

    for (const nested of Object.values(record)) visit(nested);
  };

  visit(chunk.content);
  visit((chunk as unknown as Record<string, unknown>).additional_kwargs);
  visit((chunk as unknown as Record<string, unknown>).response_metadata);

  return parts.join("");
}

function flattenText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join("");
  if (typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  return [record.text, record.content, record.summary]
    .map(flattenText)
    .join("");
}

const runtime = new AgentRuntime();

app.get("/api/conversation", (c) => c.json(runtime.snapshot()));

app.post("/api/messages", async (c) => {
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const cwd = typeof body?.cwd === "string" ? body.cwd : undefined;

  if (!text.trim()) {
    return c.json({ error: "Message cannot be empty." }, 400);
  }

  try {
    if (cwd !== undefined) {
      await runtime.setCWD(cwd);
    }

    await runtime.enqueueUserMessage(text, runtime.snapshot().cwd);
    return c.json({ ok: true, snapshot: runtime.snapshot() });
  } catch (error) {
    return c.json({ error: stringifyError(error) }, 400);
  }
});

app.post("/api/cwd", async (c) => {
  const body = await c.req.json().catch(() => null);
  const cwd = typeof body?.cwd === "string" ? body.cwd : "";

  try {
    await runtime.setCWD(cwd);
    return c.json({ ok: true, snapshot: runtime.snapshot() });
  } catch (error) {
    return c.json({ error: stringifyError(error) }, 400);
  }
});

app.post("/api/reset", (c) => {
  runtime.resetConversation();
  return c.json({ ok: true, snapshot: runtime.snapshot() });
});

app.get("/api/events", (c) => {
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    if (keepAlive) clearInterval(keepAlive);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      unsubscribe = runtime.subscribe(write);
      keepAlive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 15000);

      c.req.raw.signal.addEventListener(
        "abort",
        () => {
          cleanup();
          controller.close();
        },
        { once: true },
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

registerStaticAssets();
startServers();
