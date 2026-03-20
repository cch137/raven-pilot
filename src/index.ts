import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
  START,
  Messages,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";
import fs from "fs/promises";
import { watch } from "fs";
import { dirTreeTool } from "./tools/dir_tree";
import { readTextFilesTool } from "./tools/read_text_files";
import { getImagePart, readImageFileTool } from "./tools/read_image_files";
import { writeTextFileTool } from "./tools/write_text_file";
import { AIMessageChunk, ToolMessage } from "@langchain/core/messages";

dotenv.config();

const INPUT_FILEPATH = "input.txt";

const tools = [
  dirTreeTool,
  readTextFilesTool,
  readImageFileTool,
  writeTextFileTool,
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

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addNode("toolHandler", specialToolHandler)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition)
  .addEdge("tools", "toolHandler")
  .addEdge("toolHandler", "agent")
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

  console.log(`Watching ${INPUT_FILEPATH} for changes...`);

  while (true) {
    await waitForChange();

    const input = (await fs.readFile(INPUT_FILEPATH, "utf-8")).trim();
    if (!input) continue;

    console.log(`\n[Human]: ${input}`);

    const stream = await graph.stream(
      { messages: [{ role: "user", content: input }] },
      {
        configurable: { thread_id: "main" },
        subgraphs: true,
        streamMode: ["updates", "values"],
      },
    );

    for await (const [_subgraphs, _mode, _chunk] of stream) {
      continue;
    }
  }
})();
