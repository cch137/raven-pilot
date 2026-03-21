import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type SupportedModelProvider = "anthropic" | "openai" | "google" | "xai";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type Verbosity = "low" | "medium" | "high";

export type ModelSettings = {
  model: string;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
};

export type RoutedModelIdentifier = {
  raw: string;
  provider: SupportedModelProvider;
  model: string;
};

export const SUPPORTED_MODEL_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "xai",
] as const satisfies readonly SupportedModelProvider[];

const MODEL_ROUTE_PATTERN = /^@([a-z][a-z0-9-]*)\/(.+)$/;

export function parseRoutedModelIdentifier(
  value: string,
): RoutedModelIdentifier {
  const raw = value.trim();

  if (!raw) {
    throw new Error("Model name cannot be empty.");
  }

  const match = MODEL_ROUTE_PATTERN.exec(raw);
  if (!match) {
    throw new Error(
      `Invalid model \"${raw}\". Expected format: @provider/model. ` +
        `Supported providers: ${formatSupportedProviders()}.`,
    );
  }

  const provider = match[1] as SupportedModelProvider;
  const model = match[2]?.trim() ?? "";

  if (!SUPPORTED_MODEL_PROVIDERS.includes(provider)) {
    throw new Error(
      `Unsupported model provider \"@${provider}\". ` +
        `Supported providers: ${formatSupportedProviders()}.`,
    );
  }

  if (!model) {
    throw new Error(
      `Invalid model \"${raw}\". Missing model name after provider prefix.`,
    );
  }

  return { raw, provider, model };
}

export function createRoutedAgentModel(
  modelSettings: ModelSettings,
  tools: BindToolsInput[],
) {
  const routedModel = parseRoutedModelIdentifier(modelSettings.model);

  switch (routedModel.provider) {
    case "anthropic":
      return new ChatAnthropic({
        model: routedModel.model,
        apiKey: getRequiredApiKey("ANTHROPIC_API_KEY", routedModel.raw),
        outputConfig: {
          effort: mapAnthropicEffort(modelSettings.reasoningEffort),
        },
      }).bindTools(tools as any);

    case "openai":
      return new ChatOpenAI({
        model: routedModel.model,
        apiKey: getRequiredApiKey("OPENAI_API_KEY", routedModel.raw),
        reasoning: {
          effort: modelSettings.reasoningEffort,
          summary: "detailed",
        },
        verbosity: modelSettings.verbosity,
      }).bindTools(tools as any);

    case "google":
      return new ChatGoogleGenerativeAI({
        model: routedModel.model,
        apiKey: getRequiredApiKey("GOOGLE_API_KEY", routedModel.raw),
        thinkingConfig: {
          thinkingLevel: mapGoogleThinkingLevel(modelSettings.reasoningEffort),
        },
      }).bindTools(tools as any);

    case "xai":
      return new ChatXAI({
        model: routedModel.model,
        apiKey: getRequiredApiKey("XAI_API_KEY", routedModel.raw),
      }).bindTools(tools as any);
  }
}

function getRequiredApiKey(envName: string, rawModel: string) {
  const apiKey = process.env[envName]?.trim();

  if (!apiKey) {
    throw new Error(`Missing ${envName} for model \"${rawModel}\".`);
  }

  return apiKey;
}

function mapAnthropicEffort(value: ReasoningEffort) {
  switch (value) {
    case "minimal":
      return "low";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "max";
  }
}

function mapGoogleThinkingLevel(value: ReasoningEffort) {
  switch (value) {
    case "minimal":
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
    case "xhigh":
      return "HIGH";
  }
}

function formatSupportedProviders() {
  return SUPPORTED_MODEL_PROVIDERS.map((provider) => `@${provider}`).join(", ");
}
