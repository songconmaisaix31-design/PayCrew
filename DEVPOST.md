# PayCrew

## Tagline

Review PayPal disputes, trace draft claims to evidence, and see which records you still need.

## Project story

When a customer disputes a payment, the merchant has to check the case deadline, find the relevant order records, and decide what the evidence supports. PayCrew puts those steps in one workspace.

PayCrew reads dispute summaries and case details from the PayPal Sandbox. A reviewer opens a case, checks its status and response deadline when available, and adds short excerpts from records such as shipping logs or customer messages. The AI draft cites those excerpts by ID and lists missing evidence so the reviewer can verify the proposed response. The reviewer can record their decision and export an evidence packet.

We built PayCrew with Node.js, JavaScript, the PayPal Customer Disputes API, and an OpenAI-compatible model interface. The server uses PayPal OAuth for read-only access to the dispute queue and case details. The local demo includes clearly labeled synthetic cases and can display an example draft without an API key. The README explains how to run the demo and configure Sandbox and AI access.

## 90-second recording

| Time | On screen | Narration |
| --- | --- | --- |
| 0:00–0:12 | Start on the dispute inbox with the source badge in view. | “A dispute response starts with two questions. When is it due, and what can we prove? PayCrew brings the case and the evidence together.” |
| 0:12–0:28 | Open an item-not-received case. Point to the status, amount, and response deadline if available. | “I’ll open an item-not-received case and check what’s at stake and when the seller needs to respond.” |
| 0:28–0:47 | Add an evidence excerpt named **Carrier scan**. Use a sanitized test excerpt, such as “The carrier accepted the parcel for shipment on November 4.” Select **Generate draft**. | “I have a carrier acceptance scan. It supports that the parcel shipped. I’ll add the excerpt and draft a response.” |
| 0:47–1:09 | Show the proposed response, open or locate the cited excerpt, and point to the missing-evidence list. | “I can trace the shipment claim to the carrier scan. The draft also gives me a list of records to check before I respond, such as delivery confirmation.” |
| 1:09–1:30 | Record a review decision, export the evidence packet, and show the downloaded file. | “I can record my review and export the case, evidence, and draft together. The merchant decides what to submit through PayPal.” |

Use a verified Sandbox case when available and name the source on screen. If recording the built-in walkthrough, call it synthetic demo data and identify any example draft as an example. Align the narration about missing evidence with the draft shown.
