# How Oppenly talks to AI providers

AI is optional in Oppenly. Everything described here only runs after a user adds a provider and
agrees to send text to it. The prompts live in
[`packages/engine/src/ai/prompts.ts`](../packages/engine/src/ai/prompts.ts); the code that sends
them is in [`client.ts`](../packages/engine/src/ai/client.ts) and
[`service.ts`](../packages/engine/src/ai/service.ts).

There are four tasks:

| Task | Used for | Output | Temperature |
| --- | --- | --- | --- |
| Check | Suggestions while you type | JSON list of edits | 0 |
| Rewrite | "Improve it", "Shorten it", custom instructions | Plain text, streamed | 0 for "Fix grammar only", 0.4 otherwise |
| Compose | "Write something new" in the web app | Plain text, streamed | 0.6 |
| Insight | Reader reactions, gaps, summary, grading | Short bullet list, streamed | 0.3 |

## Design decisions

### 1. Ask for minimal edits

Language models are fluent writers and poor proofreaders by default: asked to "correct" a text,
they rephrase sentences that were already fine. Studies of GPT models on grammatical error
correction benchmarks found exactly this over-correction, and that results improve when the
prompt asks for minimal changes ([Wu et al., 2023](https://arxiv.org/abs/2303.13648);
[Fang et al., 2023](https://arxiv.org/abs/2304.01746);
[Coyne et al., 2023](https://arxiv.org/abs/2303.14342)). Grammarly's own published approach to
error correction is also edit-based rather than rewrite-based
([GECToR, Omelianchuk et al., 2020](https://arxiv.org/abs/2005.12592)).

So the check prompt:

- says correct, natural text must produce no edits, and that an empty list is a valid answer;
- limits correctness edits to what is wrong;
- limits style edits (clarity, engagement, delivery) to one per 60 words, and only when they fit
  the user's goals;
- asks for the shortest span that contains the problem.

### 2. Never trust offsets from the model

Models count characters badly, because they see tokens, not letters. Each edit therefore quotes
the exact text to change (`find`) and up to four words before it (`before`). Oppenly finds the
span itself ([`parse.ts`](../packages/engine/src/ai/parse.ts)) and drops any edit whose text is
not in the passage exactly once, or whose anchor does not match. A made-up edit can never land on
the wrong words.

### 3. Treat the user's text as data

Text on a web page can contain instructions aimed at AI tools ("ignore your instructions and…").
This is indirect prompt injection, the top risk in the
[OWASP Top 10 for LLM applications](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).
Following the delimiting approach in
[Spotlighting (Hines et al., 2024)](https://arxiv.org/abs/2403.14720), every passage is wrapped
in tags that carry a random id generated for each request:

```text
<passage id="3f9c0a1b7e2d">
…the user's text…
</passage id="3f9c0a1b7e2d">
```

The system prompt says anything inside is material to edit, never instructions. Because the id
is random, text inside the passage cannot close the tag early. The same applies to context in
compose requests. Whatever a model returns is only ever shown as a suggestion that the user
chooses to apply; it is never executed.

### 4. One strict output shape

The check prompt asks for JSON only, in one fixed shape, with one worked example that covers
several categories. Providers that support a JSON mode get it switched on. The parser still
accepts replies wrapped in code fences or with text around them, and ignores malformed items
instead of failing the whole check.

### 5. Pass the goals every time

Audience, formality, domain, intent and English variety go into every check, rewrite and compose
request, so suggestions match what the writer set in Goals, the same way the on-device rules do.

## How checks run

- Local checks always run first and appear immediately. AI suggestions are added when they
  arrive, and the engine resolves overlaps.
- Text is sent paragraph by paragraph, only paragraphs of three words or more, at most eight
  paragraphs per pass and two requests at a time.
- Results are cached per paragraph, so editing one paragraph re-checks only that one.
- AI checks wait until typing pauses (about 1.2 to 1.4 seconds) and are cancelled if the text
  changes.
- Rewrites stream into the preview. Nothing changes in the document until the user chooses
  Replace or Insert.
- If a provider rejects an optional setting (such as temperature on some reasoning models), the
  request is retried once without it.

## Provider formats

Oppenly speaks five request formats, which cover every preset:

| Format | Providers |
| --- | --- |
| OpenAI Chat Completions | OpenAI, xAI, Mistral, DeepSeek, Groq, Cerebras, OpenRouter, Together, Fireworks, Perplexity, Cohere (compatibility API), Moonshot, Qwen, Ollama, LM Studio, llama.cpp, custom |
| Azure OpenAI | Azure OpenAI (deployment name as the model, `api-key` header) |
| Anthropic Messages | Anthropic, custom Anthropic-compatible |
| Gemini `generateContent` | Google Gemini, custom Gemini-compatible |
| Bedrock Converse | Amazon Bedrock (with a Bedrock API key) |

Chrome's built-in AI uses the [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) and
never leaves the computer.

## Changing a prompt

Prompt changes affect every user's suggestions, so:

1. Keep the five decisions above.
2. Update the unit tests in [`packages/engine/test/ai.test.ts`](../packages/engine/test/ai.test.ts).
3. Try the change on a few providers (at least one small, fast model) with both correct text and
   text full of errors. Correct text must still produce no edits.
