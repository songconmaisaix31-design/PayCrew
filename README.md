# PayCrew

PayCrew is a merchant dispute review workspace. It reads cases from PayPal Sandbox, drafts a response against keyed evidence, and lets a reviewer edit, approve, and export the response together with its source excerpts.

## Run locally

Use Node.js 22 or later. There are no npm dependencies.

```sh
node server.mjs
```

Open http://127.0.0.1:4173. The built-in sample cases are synthetic. With no model key, the sample draft is labeled as an example.

## Connect PayPal Sandbox and an AI model

Copy `.env.example` to `.env`. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from your Sandbox merchant app under **Apps & Credentials**. Enable **Customer disputes** in the app. Set `AI_BASE_URL` to your provider's OpenAI-compatible API base, `AI_MODEL` to its model ID, and `AI_API_KEY` to its API key. The server appends `/chat/completions`. For a provider that supports native JSON mode, you can add `AI_JSON_MODE=1`.

```sh
node --env-file=.env server.mjs
```

The application only calls the PayPal Sandbox API host. It retrieves a token and reads the first 50 disputes and individual case details. A successful connection with zero disputes should produce an empty inbox. To exercise case review, use a sandbox personal buyer and the sandbox business tied to the merchant app. Complete a test payment and use the buyer’s Sandbox Resolution Center to report a problem with that payment.

The configured model receives the dispute reason, status and reviewer-entered evidence excerpts. Use sanitized excerpts for testing. PayPal access is read-only. The merchant can use the exported packet when responding in PayPal.

- [PayPal Sandbox setup](https://developer.paypal.com/platforms/disputes/set-up/)
- [PayPal Disputes API](https://developer.paypal.com/platforms/disputes/handle-disputes/use-disputes-api/)

## Demo sequence

1. Open the inbox and show the data source.
2. Open a case and check the reason, amount, status and response deadline if available.
3. Add an evidence excerpt. Generate a draft and verify each reference against the supplied evidence.
4. Review the missing records, edit the proposed response, and explicitly approve it.
5. Download the evidence packet. It records the case, cited excerpts, draft, gaps, and reviewed response.

The server binds to localhost. Save the downloaded packet to retain a review across sessions.
