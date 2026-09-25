# Publishing the extension

A step-by-step guide to putting Oppenly on the Chrome Web Store, with the text to paste into
every field. It also covers Microsoft Edge and Firefox at the end.

Everything below matches the current package: the permissions, the privacy behaviour and the
listing images in [`docs/store`](store/). If you change what the extension does, update this
guide and the [privacy policy](../PRIVACY.md) in the same pull request.

## Before you start

1. **A Google account with 2-Step Verification.** The store requires it before you can publish
   or update anything. Turn it on at https://myaccount.google.com/security.
2. **A developer account.** Go to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), accept
   the developer agreement and pay the one-time US$5 registration fee.
3. **Account details.** In the dashboard's Account page:
   - Set the publisher name to how you want to appear, for example "Shivashis Adhikari".
   - Verify the contact email address. It is shown to Google, not published on the listing,
     unless you choose to.
   - Declare **non-trader** if you publish Oppenly as an individual without commercial intent.
     This is an EU requirement; decide based on your own situation.

## 1. Build and check the package

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm zip:extension
```

The package is `apps/extension/.output/oppenly-1.0.0-chrome.zip` (the version comes from
`apps/extension/package.json`). Tagging a version (`git tag v1.0.0 && git push origin v1.0.0`)
also builds it on GitHub and attaches it to a release. The release notes come from
`docs/releases/v1.0.0.md` (named after the tag); without that file, GitHub lists the changes.

Test the exact file you will upload:

1. Unzip it to a folder.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick
   the folder.
3. Check the welcome page opens, then type `Their going to the store tomorow.` into any text box
   on a website. Underlines should appear within a second.
4. Remove it again before installing from the store later.

## 2. Create the item

In the dashboard, click **Add new item** and upload the zip. The dashboard opens the item with
several tabs. Fill them in as below, then submit.

## 3. Store listing tab

The name and summary come from the package:

| Field | Value |
| --- | --- |
| Name | Oppenly: Grammar Checker & Writing Assistant |
| Summary | Grammar, clarity and tone suggestions on almost any website. Runs on your device. Free and open source. |

**Description** (paste as is; the store shows plain text):

```text
Oppenly checks your writing as you type on almost any website and fixes mistakes in one click. It runs on your device: no account, no tracking, and your text is not sent anywhere to be checked.

WHAT IT CHECKS
• Correctness: spelling, grammar, punctuation, verb forms and commonly confused words
• Clarity: wordy phrases, passive voice and hard-to-read sentences
• Engagement: bland, overused and repeated words
• Delivery: tone, confidence, politeness and inclusive language

HOW IT WORKS
• Coloured underlines appear in text boxes and rich-text editors as you type.
• Hover an underline to see the fix and a short explanation, then click to apply it.
• Click the Oppenly button in the corner of a text box to see every suggestion, accept all spelling and grammar fixes at once, check the tone and see an overall score.
• Select text to make it shorter, more formal, friendlier or more confident.
• Set goals for your audience, formality, domain and intent, and choose American, British, Canadian, Australian or Indian English.
• Pause Oppenly for an hour, or turn it off on a site, from the button in the text box.

PRIVATE BY DESIGN
• Checking runs inside your browser, powered by the open-source Harper grammar engine and Oppenly’s own style rules. It also works offline.
• No account, no analytics and no ads. Oppenly has no servers.
• Your settings and personal dictionary stay on your computer.

OPTIONAL AI, YOUR CHOICE
Connect an AI provider for context-aware suggestions and full rewrites with your own API key: OpenAI, Anthropic, Google Gemini and 14 more, or a model that runs on your computer. Oppenly asks for your consent before any text is sent, and sends it only to the provider you chose. There are no prompt limits.

GOOD TO KNOW
• Oppenly does not work in Google Docs yet.
• Free and open source under the Apache 2.0 license. Source code, issues and privacy policy: https://github.com/shivashis-adhikari/Oppenly
```

| Field | Value |
| --- | --- |
| Category | Tools |
| Language | English |
| Store icon | [`docs/store/icon-128.png`](store/icon-128.png) |
| Screenshots | [`docs/store/screenshot-1.png`](store/screenshot-1.png) to `screenshot-5.png`, in order |
| Small promo tile | [`docs/store/promo-small-440x280.png`](store/promo-small-440x280.png) |
| Marquee promo tile | [`docs/store/marquee-1400x560.png`](store/marquee-1400x560.png) |
| Homepage URL | https://shivashis-adhikari.github.io/Oppenly/ |
| Support URL | https://github.com/shivashis-adhikari/Oppenly/issues |
| Mature content | No |

To refresh the images after a design change, build both apps and run:

```sh
pnpm --filter @oppenly/site screenshots
pnpm --filter @oppenly/site store-assets
```

## 4. Privacy tab

**Single purpose:**

```text
Oppenly checks and improves the user’s writing in text fields on websites: it suggests spelling, grammar, clarity and tone corrections and applies the ones the user chooses.
```

**Permission justifications:**

| Permission | Justification to paste |
| --- | --- |
| `storage` | Saves the user’s settings, personal dictionary and the list of sites where Oppenly is turned off, on the user’s device. |
| `contextMenus` | Adds “Rewrite with Oppenly” and “Open Oppenly assistant” to the right-click menu for selected or editable text. |
| Host permission (content script on all sites) | The extension’s single purpose is checking text the user writes in text fields, which can be on any website. The content script only reads editable fields the user focuses, checks the text on the device and draws underlines. Users can turn it off for a site or everywhere. |
| Optional host permissions (`https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`) | Requested at runtime, one address at a time, only when the user adds an AI provider. They let the extension send the text the user chooses to check or rewrite to the provider address the user entered and consented to. Local addresses are for AI models running on the user’s computer. |

**Remote code:** choose **No, I am not using remote code**. Justification if asked: "All
JavaScript and the WebAssembly grammar engine are included in the package. Nothing is loaded from
the internet."

**Data usage.** Tick these two categories:

- **Website content**
- **Personal communications**

They cover the only case where text leaves the device: when the user connects an AI provider,
the text they check or rewrite (which may be an email or message) is sent to that provider.
Nothing is collected by the developer. Then tick all three certifications:

- I do not sell or transfer user data to third parties, apart from the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item’s single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://shivashis-adhikari.github.io/Oppenly/privacy.html

## 5. Distribution tab

| Field | Value |
| --- | --- |
| Payments | Free of charge |
| Visibility | Public (or Unlisted for a private beta first) |
| Regions | All regions |

## 6. Test instructions tab

```text
No account, key or setup is needed.

1. After installing, a welcome page opens with a live demo text box that already contains mistakes. Hover an underline and click the fix.
2. On any website with a text box (for example a comment or contact form), type: "Their going to the store tomorow and the results is good." Underlines appear within a second.
3. Click the round Oppenly button in the bottom corner of the text box to open the assistant with all suggestions.
4. Hover the button and click the power icon to pause Oppenly or turn it off for the site.

AI providers are optional and need the reviewer’s own API key. All checking and the rewrite options in the selection toolbar work without one. The source code is public at https://github.com/shivashis-adhikari/Oppenly.
```

## 7. Submit for review

1. Click **Submit for review**.
2. In the dialog, untick **Publish automatically after approval** if you want to choose the launch
   day. Once approved, you then have 30 days to publish from the item’s menu before it returns to
   draft.
3. Reviews usually take a few days. Extensions that run on all sites get a closer review and can
   take longer. The dashboard shows the status, and Google emails you the result.

If it is rejected, the email names a policy and a violation ID. Fix exactly that, note what
changed in the resubmission, and submit again.

## 8. After approval

1. Publish (if you deferred it).
2. Point the website at the listing: in [`apps/site/index.html`](../apps/site/index.html), change
   the `href` of the links marked `data-install` to the store URL, and their text to "Add to
   Chrome". Do the same for the install link in the [README](../README.md).
3. For every update: raise the version in `apps/extension/package.json`, write the release notes
   in `docs/releases/v1.0.1.md`, tag it
   (`git tag v1.0.1 && git push origin v1.0.1`), download the zip from the GitHub release, upload
   it in the dashboard's Package tab and submit. Adding a new required permission disables the
   extension for existing users until they accept it, so add new permissions as optional.

## Microsoft Edge

Edge users can already install from the Chrome Web Store. To also list on Edge Add-ons:

1. Register (free) in [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview).
2. Upload the same zip.
3. Reuse the description, images, privacy policy URL and test instructions above.

Reviews there take up to about seven business days.

## Firefox

```sh
pnpm --filter @oppenly/extension zip:firefox
```

This creates `oppenly-1.0.0-firefox.zip` and `oppenly-1.0.0-sources.zip` in
`apps/extension/.output`. Firefox reviewers need the source package because the code is bundled.
Give them these build steps:

```text
Requires Node.js 22 and pnpm 10.
pnpm install
pnpm --filter @oppenly/extension build:firefox
The built extension is in apps/extension/.output/firefox-mv3.
```

The Firefox build declares that it collects no data by default, and lists website content and
personal communications as optional. When a user adds an AI provider, Firefox asks them to allow
this at the same moment as Oppenly's own consent step. It needs Firefox 140 or later.

The automated tests run in Chromium, so try the Firefox build by hand in Firefox before
submitting at https://addons.mozilla.org/developers/.
