/** Wire protocols. Almost every provider speaks one of these. */
export type Protocol = 'openai' | 'anthropic' | 'gemini' | 'azure' | 'bedrock' | 'on-device';

export interface ProviderPreset {
  id: string;
  name: string;
  protocol: Protocol;
  /** Default API base URL. Users can override it. */
  baseUrl: string;
  keyRequired: boolean;
  /** Where users create a key. */
  keyUrl?: string;
  /** Provider privacy policy, shown on the consent screen. */
  privacyUrl?: string;
  website: string;
  /** Runs on the user's own machine: nothing leaves the device. */
  local: boolean;
  /** The provider exposes a model list we can load. */
  listsModels: boolean;
  /** Supports `response_format: { type: 'json_object' }` (OpenAI-style providers). */
  jsonMode: boolean;
  /** Extra setup note shown under the form. */
  note?: string;
}

/** Presets. URLs are verified at release time; users can override any of them. */
export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'on-device',
    name: 'Chrome built-in AI',
    protocol: 'on-device',
    baseUrl: '',
    keyRequired: false,
    website: 'https://developer.chrome.com/docs/ai/built-in',
    local: true,
    listsModels: false,
    jsonMode: true,
    note: 'Uses the model built into Chrome. Nothing leaves your computer. Needs a recent Chrome and a capable device.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyRequired: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    privacyUrl: 'https://openai.com/policies/privacy-policy',
    website: 'https://openai.com',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyRequired: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    privacyUrl: 'https://www.anthropic.com/legal/privacy',
    website: 'https://www.anthropic.com',
    local: false,
    listsModels: true,
    jsonMode: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyRequired: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    privacyUrl: 'https://ai.google.dev/gemini-api/terms',
    website: 'https://ai.google.dev',
    local: false,
    listsModels: true,
    jsonMode: false,
  },
  {
    id: 'xai',
    name: 'xAI',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyRequired: true,
    keyUrl: 'https://console.x.ai',
    privacyUrl: 'https://x.ai/legal/privacy-policy',
    website: 'https://x.ai',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    keyRequired: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
    privacyUrl: 'https://mistral.ai/terms',
    website: 'https://mistral.ai',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    keyRequired: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    website: 'https://www.deepseek.com',
    privacyUrl: 'https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyRequired: true,
    keyUrl: 'https://console.groq.com/keys',
    privacyUrl: 'https://groq.com/privacy-policy',
    website: 'https://groq.com',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    protocol: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyRequired: true,
    keyUrl: 'https://cloud.cerebras.ai',
    website: 'https://www.cerebras.ai',
    privacyUrl: 'https://www.cerebras.ai/privacy-policy',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyRequired: true,
    keyUrl: 'https://openrouter.ai/keys',
    privacyUrl: 'https://openrouter.ai/privacy',
    website: 'https://openrouter.ai',
    local: false,
    listsModels: true,
    jsonMode: true,
    note: 'One key gives access to models from many providers.',
  },
  {
    id: 'together',
    name: 'Together AI',
    protocol: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    keyRequired: true,
    keyUrl: 'https://api.together.ai/settings/api-keys',
    privacyUrl: 'https://www.together.ai/privacy',
    website: 'https://www.together.ai',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    protocol: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    keyRequired: true,
    keyUrl: 'https://fireworks.ai/account/api-keys',
    privacyUrl: 'https://fireworks.ai/privacy-policy',
    website: 'https://fireworks.ai',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    protocol: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    keyRequired: true,
    keyUrl: 'https://www.perplexity.ai/settings/api',
    privacyUrl: 'https://www.perplexity.ai/hub/legal/privacy-policy',
    website: 'https://www.perplexity.ai',
    local: false,
    listsModels: false,
    jsonMode: false,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    protocol: 'openai',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    keyRequired: true,
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    privacyUrl: 'https://cohere.com/privacy',
    website: 'https://cohere.com',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    protocol: 'azure',
    baseUrl: 'https://YOUR-RESOURCE.openai.azure.com',
    keyRequired: true,
    keyUrl: 'https://portal.azure.com',
    privacyUrl: 'https://privacy.microsoft.com/privacystatement',
    website: 'https://azure.microsoft.com/products/ai-services/openai-service',
    local: false,
    listsModels: false,
    jsonMode: true,
    note: 'Use your resource URL. The model field is your deployment name.',
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    protocol: 'bedrock',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    keyRequired: true,
    keyUrl: 'https://console.aws.amazon.com/bedrock',
    privacyUrl: 'https://aws.amazon.com/privacy',
    website: 'https://aws.amazon.com/bedrock',
    local: false,
    listsModels: false,
    jsonMode: false,
    note: 'Use a Bedrock API key and the endpoint for your region. The model field is the model ID.',
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    keyRequired: true,
    keyUrl: 'https://platform.moonshot.ai',
    website: 'https://www.moonshot.ai',
    privacyUrl: 'https://www.kimi.com/user/agreement/userPrivacy?version=v2',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    protocol: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyRequired: true,
    keyUrl: 'https://modelstudio.console.alibabacloud.com',
    website: 'https://www.alibabacloud.com/product/modelstudio',
    privacyUrl: 'https://www.alibabacloud.com/help/en/model-studio/privacy-notice',
    local: false,
    listsModels: true,
    jsonMode: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    keyRequired: false,
    website: 'https://ollama.com',
    local: true,
    listsModels: true,
    jsonMode: true,
    note: 'Runs on your computer. If requests are blocked, start Ollama with OLLAMA_ORIGINS=chrome-extension://* set.',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    protocol: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    keyRequired: false,
    website: 'https://lmstudio.ai',
    local: true,
    listsModels: true,
    jsonMode: false,
    note: 'Runs on your computer. Turn on “Enable CORS” in LM Studio’s server settings.',
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp server',
    protocol: 'openai',
    baseUrl: 'http://localhost:8080/v1',
    keyRequired: false,
    website: 'https://github.com/ggml-org/llama.cpp',
    local: true,
    listsModels: true,
    jsonMode: false,
  },
  {
    id: 'custom-openai',
    name: 'OpenAI-compatible',
    protocol: 'openai',
    baseUrl: 'https://',
    keyRequired: false,
    website: '',
    local: false,
    listsModels: true,
    jsonMode: false,
    note: 'Any server that implements the OpenAI Chat Completions API.',
  },
  {
    id: 'custom-anthropic',
    name: 'Anthropic-compatible',
    protocol: 'anthropic',
    baseUrl: 'https://',
    keyRequired: false,
    website: '',
    local: false,
    listsModels: false,
    jsonMode: false,
  },
  {
    id: 'custom-gemini',
    name: 'Gemini-compatible',
    protocol: 'gemini',
    baseUrl: 'https://',
    keyRequired: false,
    website: '',
    local: false,
    listsModels: false,
    jsonMode: false,
  },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** A configured provider. The API key lives here only in trusted contexts. */
export interface ProviderConfig {
  presetId: string;
  baseUrl: string;
  apiKey: string;
  /** Model used for live checks (fast and inexpensive). */
  checkModel: string;
  /** Model used for rewrites and writing (better quality). */
  writeModel: string;
  /** Timestamp of the user's explicit consent to send text to this provider. Null = no consent. */
  consentedAt: number | null;
}

/** Ranks model ids so the fastest, cheapest ones come first for live checks. */
export function rankModelsForChecking(ids: string[]): string[] {
  const score = (id: string) => {
    const s = id.toLowerCase();
    let n = 0;
    if (/(mini|flash|haiku|small|lite|fast|instant|8b|7b|nano)/.test(s)) n += 3;
    if (
      /(embed|whisper|tts|dall|image|vision-only|moderation|audio|realtime|transcribe|rerank|guard)/.test(
        s,
      )
    )
      n -= 10;
    if (/(preview|exp|beta)/.test(s)) n -= 1;
    return n;
  };
  return [...ids].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}
