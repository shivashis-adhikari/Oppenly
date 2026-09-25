# Privacy policy

Effective 25 September 2026. Applies to the Oppenly browser extension and the Oppenly web app.
The same policy is published at https://shivashis-adhikari.github.io/Oppenly/privacy.html.

## In short

- Oppenly checks your writing on your own device.
- We do not collect, receive, store, sell or share any of your data. Oppenly has no servers,
  analytics or ads.
- If you choose to connect an AI provider, the text you check or rewrite is sent to that
  provider, and only after you agree.

## Who we are

Oppenly is a free, open-source project maintained by Shivashis Adhikari ("we", "us"). The source
code is public at https://github.com/shivashis-adhikari/Oppenly, so anyone can check how it
handles data.

## What Oppenly handles on your device

| Data | Why | Where it stays |
| --- | --- | --- |
| Text you type in fields where Oppenly is active | To find spelling, grammar, clarity and tone suggestions | In memory while you write. The extension does not save it. |
| Documents you write in the web app | So you can come back to them | Your browser's storage on your computer |
| Settings, goals, personal dictionary, sites where Oppenly is off | To remember your choices | Your browser's storage on your computer |
| AI provider settings and API keys, if you add them | To connect to the provider you chose | Your browser's storage, with keys encrypted by a key the browser keeps and never exposes |

None of this is sent to us. We have no way to see it.

## What we never collect

Oppenly does not collect personal information, browsing history, usage statistics, crash
reports or device identifiers. It uses no analytics, no advertising, no tracking cookies and no
third-party scripts. It does not sell or transfer data to anyone.

## Optional AI providers

Oppenly works fully without AI. You can choose to connect an AI provider for extra suggestions
and rewrites. If you do:

- You pick the provider and enter your own API key. For providers on the internet, Oppenly shows
  what will be sent and where, and only turns the provider on after you tick a consent box.
- When an AI feature runs, the text being checked or rewritten, with instructions for the task
  and any goals you set, is sent to the provider's address using your key. Nothing else from the
  page or your browser is included.
- The extension sends this directly from your browser. The web app sends it through the small
  Oppenly server that runs on your own computer, which passes it straight on and keeps nothing.
- The provider's own terms and privacy policy apply to what it receives. We do not receive your
  text or your key.
- To stop, remove the provider in Oppenly's settings. This deletes your key from your device.

### Providers you can choose

Oppenly has ready-made settings for these internet AI services. None of them receives anything
unless you set it up and agree.

| Provider | Privacy information |
| --- | --- |
| OpenAI | https://openai.com/policies/privacy-policy |
| Anthropic | https://www.anthropic.com/legal/privacy |
| Google Gemini | https://ai.google.dev/gemini-api/terms |
| xAI | https://x.ai/legal/privacy-policy |
| Mistral AI | https://mistral.ai/terms |
| DeepSeek | https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html |
| Groq | https://groq.com/privacy-policy |
| Cerebras | https://www.cerebras.ai/privacy-policy |
| OpenRouter | https://openrouter.ai/privacy |
| Together AI | https://www.together.ai/privacy |
| Fireworks AI | https://fireworks.ai/privacy-policy |
| Perplexity | https://www.perplexity.ai/hub/legal/privacy-policy |
| Cohere | https://cohere.com/privacy |
| Azure OpenAI (Microsoft) | https://privacy.microsoft.com/privacystatement |
| Amazon Bedrock (AWS) | https://aws.amazon.com/privacy |
| Moonshot AI (Kimi) | https://www.kimi.com/user/agreement/userPrivacy?version=v2 |
| Alibaba Qwen (Alibaba Cloud Model Studio) | https://www.alibabacloud.com/help/en/model-studio/privacy-notice |

You can also enter the address of any other service that is compatible with the OpenAI,
Anthropic or Gemini APIs. In that case your text goes to the address you entered, under that
service's terms.

Some options run on your computer instead, such as Chrome's built-in AI, Ollama, LM Studio and
llama.cpp. With these, your text stays on your computer. Chrome may download its built-in model
from Google when you first use it; that download is handled by Chrome.

## Browser permissions (extension)

| Permission | Why Oppenly needs it |
| --- | --- |
| Read and change data on the websites you visit | To read the text you type in text boxes, show underlines and apply the fixes you choose. Text is checked on your device. |
| Storage | To save your settings and dictionary on your device. |
| Context menus | To add "Rewrite with Oppenly" and "Open Oppenly assistant" to the right-click menu. |
| Access to an AI provider's address (optional) | Requested only when you add a provider, for that provider's address only. |

Oppenly's use of data complies with the Chrome Web Store User Data Policy, including the Limited
Use requirements.

## Keeping and deleting your data

Everything is stored on your device, under your control. You can delete it all at any time from
Settings, Privacy & data. Uninstalling the extension removes its data. For the web app, clearing
site data for the web app's address in your browser removes it.

## Security

Oppenly ships no remote code and loads nothing from the internet to run. API keys are encrypted
at rest. The web app's server only listens on your own computer and only forwards requests from
the Oppenly page, to the provider address you saved. If you find a security problem, please
report it privately through GitHub's private vulnerability reporting (see SECURITY.md).

## Children

Oppenly is not directed at children under 13, and it does not knowingly collect data from
anyone, including children.

## Your rights

Because we do not collect or hold any personal data, we have no data about you to access,
correct or delete. For text you sent to an AI provider, contact that provider to use your rights
under laws such as the GDPR or CCPA.

## Changes to this policy

If this policy changes, we will update it here and on the website with a new effective date.
Changes that affect how data is handled will also be noted in the release notes.

## Contact

For questions about this policy, open an issue at
https://github.com/shivashis-adhikari/Oppenly/issues. Please do not include personal or
sensitive information in public issues.
