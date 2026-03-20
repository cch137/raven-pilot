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
import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs/promises";
import { watch } from "fs";
import { dirTreeTool } from "./tools/dir_tree";
import { readTextFilesTool } from "./tools/read_text_files";
import { getImagePart, readImageFileTool } from "./tools/read_image_files";
import { writeTextFileTool } from "./tools/write_text_file";

dotenv.config();

const INPUT_FILEPATH = "input.txt";

const signal = { shouldExit: false, shouldReset: false };

const tools = [
  dirTreeTool,
  readTextFilesTool,
  readImageFileTool,
  writeTextFileTool,
  tool(
    () => {
      signal.shouldExit = true;
      return "Exiting the conversation...";
    },
    {
      name: "exit",
      description: "End the conversation",
      schema: z.object({}),
    },
  ),
  tool(
    () => {
      signal.shouldReset = true;
      return "Starting a new conversation. Memory has been cleared.";
    },
    {
      name: "reset",
      description: "Start a new conversation and clear all memory",
      schema: z.object({}),
    },
  ),
];

const model = new ChatOpenAI("gpt-5.4", {
  apiKey: process.env["OPENAI_API_KEY"],
  reasoning: { effort: "low", summary: "detailed" },
  verbosity: "low",
}).bindTools(tools);

async function callModel(state: typeof MessagesAnnotation.State) {
  const stream = await model.stream(state.messages);
  let wrote = false;
  let full: AIMessageChunk | null = null;

  for await (const chunk of stream) {
    full = full ? full.concat(chunk) : chunk;
    const text = chunk.text ?? "";
    if (!text) continue;
    if (!wrote) {
      process.stdout.write(encode(`\n[Assistant]: `));
      wrote = true;
    }
    process.stdout.write(encode(chunk.text));
  }

  if (wrote) console.log("");

  if (full?.tool_calls) {
    for (const toolCall of full.tool_calls) {
      console.log(
        `\n[Tool Call]: ${toolCall.name}(${truncate(JSON.stringify(toolCall.args))})`,
      );
    }
  }

  return { messages: full ? [full] : [] };
}

function specialToolHandler(state: typeof MessagesAnnotation.State) {
  const messages: Messages = [];

  for (const message of state.messages) {
    if (!ToolMessage.isInstance(message)) continue;
    if (!message.id) message.id = crypto.randomUUID();
    const part = getImagePart(message.text);
    if (!part) continue;
    messages.push({
      role: "human",
      content: [{ type: "image_url", image_url: { url: part.url } }],
    });
  }

  return { messages };
}

function shouldStop() {
  return signal.shouldExit || signal.shouldReset ? "stop" : "agent";
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addNode("toolHandler", specialToolHandler)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition)
  .addEdge("tools", "toolHandler")
  .addConditionalEdges("toolHandler", shouldStop, {
    agent: "agent",
    stop: END,
  })
  .compile({ checkpointer: new MemorySaver() });

async function waitForChange(): Promise<void> {
  return new Promise((resolve) => {
    const watcher = watch(INPUT_FILEPATH, (eventType) => {
      if (eventType === "change") {
        watcher.close();
        resolve();
      }
    });
  });
}

async function exists(filepath: string): Promise<boolean> {
  try {
    await fs.stat(filepath);
    return true;
  } catch {
    return false;
  }
}

function truncate(content: string): string {
  return content.length > 80 ? content.substring(0, 80) + "..." : content;
}

const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);

(async () => {
  if (!(await exists(INPUT_FILEPATH))) {
    await fs.writeFile(INPUT_FILEPATH, "", "utf-8");
  }

  let threadId = crypto.randomUUID();
  console.log(
    `Watching ${INPUT_FILEPATH} for changes... (thread: ${threadId})`,
  );

  while (true) {
    await waitForChange();

    const input = (await fs.readFile(INPUT_FILEPATH, "utf-8")).trim();
    if (!input) continue;

    console.log(`\n[Human]: ${input}`);

    signal.shouldExit = false;
    signal.shouldReset = false;

    const stream = await graph.stream(
      { messages: [{ role: "user", content: input }] },
      {
        configurable: { thread_id: threadId },
        subgraphs: true,
        streamMode: ["updates", "values"],
      },
    );

    for await (const [_subgraphs, _mode, _chunk] of stream) {
      if (signal.shouldExit || signal.shouldReset) break;
    }

    if (signal.shouldExit) {
      console.log("\n[System]: Conversation ended. Exiting.");
      process.exit(0);
    }

    if (signal.shouldReset) {
      threadId = crypto.randomUUID();
      console.log(
        `\n[System]: New conversation started. (thread: ${threadId})`,
      );
    }
  }
})();
