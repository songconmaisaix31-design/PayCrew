# PayCrew

PayCrew is a case-aware assistant for merchant disputes. Open a PayPal Sandbox case, ask what is missing or paste order notes, and get an evidence-linked response you can edit, approve, and export.

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

The model receives the case reason, status, amount and deadline, along with the request and evidence excerpts you enter. Use sanitized excerpts for testing. PayPal access is read-only. The merchant can use the exported packet when responding in PayPal.

- [PayPal Sandbox setup](https://developer.paypal.com/platforms/disputes/set-up/)
- [PayPal Disputes API](https://developer.paypal.com/platforms/disputes/handle-disputes/use-disputes-api/)

## Demo sequence

1. Open a case and ask what to verify. PayCrew uses the selected case details.
2. Paste evidence into the same composer and ask for a draft. Open the references to check the underlying excerpts.
3. Edit and confirm the response, then download the case, evidence, draft, and reviewed response as one packet.

The server binds to localhost. Save the downloaded packet to retain a review across sessions.

To record the walkthrough, run **Actions → Record PayCrew demo**. Use `fixture` for a synthetic preview or `fixture-live-ai` to run real AI on synthetic disputes. Live AI uses the `AI_API_KEY` repository secret and the `AI_BASE_URL` and `AI_MODEL` repository variables. The `sandbox` mode also needs `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and an item-not-received test dispute. The workflow returns a WebM video.
