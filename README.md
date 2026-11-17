<div align="center">

# PayCrew

A loopback-only PayPal dispute workspace: open a case, paste the excerpts you already have, and get a draft in which every factual claim carries an evidence ID.

一个只绑定本机回环地址的 PayPal 争议工作台：打开案子、贴进手上已有的摘录，拿到一份每条事实都带证据编号的草稿。

![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![node](https://img.shields.io/badge/node-22%2B-blue.svg)](server.mjs)
[![paypal](https://img.shields.io/badge/PayPal-Sandbox%20read--only-00457C.svg)](server.mjs)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

> **How to read this page / 怎么读这页**
> English first, then the same content in Chinese — not a summary, not a separate version. Tables keep both languages in one cell.
> 每段英文在前，同一内容的中文紧跟在后；不是摘要，也没有单独的中文版。表格把两种语言放进同一格。

---

## At a glance · 一眼看懂

| | |
|---|---|
| **Problem<br/>问题** | A dispute response starts with two questions: when is it due, and what can we actually prove. The deadline lives in PayPal, the proof lives in order notes and carrier scans, and nothing joins them.<br/>争议应诉只有两个问题：什么时候到期、到底能证明什么。期限在 PayPal 里，证据在订单备注和承运商扫描件里，两边没有连起来。 |
| **Fix<br/>做法** | One local page that reads the case from the PayPal Sandbox read-only, accepts pasted excerpts, and returns a draft with `[E1]`-style citations plus the records still missing.<br/>一个本地页面：只读读取 PayPal Sandbox 案子，接收贴入的摘录，返回带 `[E1]` 式引用的草稿，并列出还缺哪些材料。 |
| **Cost<br/>代价** | Node 22 or later, no npm dependencies, no build step. Sandbox credentials and a model key are optional — without them the app still runs on two built-in fixtures.<br/>Node 22 以上，没有 npm 依赖，不需要构建。Sandbox 凭据和模型 key 都是可选的；不给也能用两条内置样例跑起来。 |
| **Not<br/>不是** | Not a filing tool. It never writes to PayPal, never moves money, and keeps no database — the exported packet is the only record.<br/>不是提交工具：不向 PayPal 写任何内容、不碰资金、没有数据库；导出的那份材料是唯一记录。 |

## The problem · 问题在哪

A merchant dispute gives you a reason code, an amount and a deadline, and then leaves the hard part to you: deciding which records support the reply. Model-generated prose makes that harder, not easier, because a fluent sentence about delivery confirmation looks the same whether or not a delivery scan exists.

商家争议只会给你原因代码、金额和截止时间，剩下的难处全在自己身上：判断哪些记录能支撑应诉。模型生成的顺滑文字让这件事更难而不是更容易——一句"已确认妥投"听起来都一样，不管有没有妥投扫描。

PayCrew's answer is structural rather than editorial. Only excerpts that were pasted into the request can substantiate a claim, each one is renamed `E1`…`E8`, and the model has to cite those IDs inline. `server.mjs` then re-checks the result: any `[E#]` in `proposedResponse` that is not in the submitted set rejects the whole draft with HTTP 502 instead of showing it.

PayCrew 的做法是结构上的，不是措辞上的。只有贴进请求里的摘录才能支撑结论，每条按顺序改名为 `E1`…`E8`，模型必须在句子里内联引用这些编号。`server.mjs` 随后重新校验：`proposedResponse` 里出现任何不在提交集合中的 `[E#]`，整份草稿作废并返回 HTTP 502，而不是照原样显示。

## The idea · 思路

| Noun · 名词 | Where it lives · 位置 | Rule · 规则 |
|---|---|---|
| **Case** | `GET /api/disputes/:id` | Exactly five fields are exposed: id, reason, status, amount, response due date.<br/>只暴露五个字段：编号、原因、状态、金额、应答截止日。 |
| **Excerpt** | `evidence[]` in the draft request | At most 8; label ≤ 100 characters, text ≤ 2000; order decides the ID.<br/>最多 8 条；标题不超过 100 字符，正文不超过 2000；顺序即编号。 |
| **Citation** | `[E1]` inside `proposedResponse` | Must match a submitted excerpt, otherwise the draft is discarded.<br/>必须命中已提交的摘录，否则草稿被丢弃。 |
| **Missing record** | `missingEvidence[]` | Names what is still needed; it is not a promise that anything was sent.<br/>指出还缺什么，不表示任何东西已经发出。 |
| **Packet** | Browser export | Case + excerpts + draft + your edited text in one JSON file, the only durable record.<br/>案子、摘录、草稿和修改后的文字打成一个 JSON，这是唯一的持久记录。 |

The practical test of the idea: run it without a model key. You should get a draft that is labelled `Example draft (no model called)`, reuses your excerpt text verbatim, and contains no invented dates, tracking numbers or refund promises.

验证这条思路最直接的办法：不配模型 key 跑一遍。应该拿到一份标着 `Example draft (no model called)` 的草稿，它原样复述你的摘录，不编造日期、运单号或退款承诺。

## Capabilities · 能力清单

| Surface · 入口 | What it does · 做什么 | Verify · 怎么验证 |
|---|---|---|
| `GET /` | Serves the single page from `public/index.html`.<br/>返回 `public/index.html` 那个单页。 | HTTP 200 on the loopback address.<br/>回环地址上返回 200。 |
| `GET /api/disputes` | Reads up to 50 disputes from the Sandbox; without credentials it returns two labelled fixtures.<br/>从 Sandbox 读最多 50 条争议；没有凭据时返回两条标注清楚的样例。 | `source` is `fixture` or `sandbox`, and each item is the five-field view.<br/>看 `source` 是 `fixture` 还是 `sandbox`，每项都是五字段视图。 |
| `GET /api/disputes/:id` | One case, same five fields.<br/>单条案子，同样五个字段。 | Unknown id returns 404 with a JSON error.<br/>不存在的编号返回 404 和 JSON 错误。 |
| `POST /api/disputes/:id/draft` | Drafts the response and returns citations plus missing records.<br/>生成应诉草稿，返回引用列表与缺失材料。 | 400 on oversized input, 413 above 80 KB, 502 when the model answer fails the citation check.<br/>输入超限返回 400，超过 80 KB 返回 413，引用校验失败返回 502。 |
| Local-only guard | Rejects non-loopback `Host`, cross-site origin and `sec-fetch-site: cross-site`.<br/>拒绝非回环 `Host`、跨站 origin 和 `sec-fetch-site: cross-site`。 | `curl -H 'Host: example.com' http://127.0.0.1:4173/api/disputes` returns 403.<br/>该请求返回 403。 |

## Quickstart · 快速开始

### Requirements · 环境要求

Node.js 22 or later. There is no `package.json`, so there is nothing to install.

Node.js 22 以上。仓库里没有 `package.json`，所以没有依赖要装。

### 1. Run · 运行

```sh
node server.mjs
# PayCrew on http://127.0.0.1:4173 (fixture)
```

Open `http://127.0.0.1:4173`. The built-in sample cases are synthetic and are labelled as such in the UI.

打开 `http://127.0.0.1:4173`。内置样例是合成数据，界面上有标注。

### 2. Verify · 验证

```sh
curl -s http://127.0.0.1:4173/api/disputes
```

```json
{"source":"fixture","items":[{"dispute_id":"DEMO-1001","reason":"MERCHANDISE_OR_SERVICE_NOT_RECEIVED","status":"WAITING_FOR_SELLER_RESPONSE","dispute_amount":{"value":"149.00","currency_code":"USD"},"seller_response_due_date":"2026-11-19T12:32:43.987Z"},{"dispute_id":"DEMO-1002","reason":"MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED","status":"UNDER_REVIEW","dispute_amount":{"value":"84.50","currency_code":"USD"}}]}
```

The due date is computed as "now + 48 hours" at process start, so the timestamp differs on every run.

截止日是进程启动时的"当前时间 + 48 小时"，每次运行的时间戳都不一样。

```sh
curl -s -X POST http://127.0.0.1:4173/api/disputes/DEMO-1001/draft \
  -H 'content-type: application/json' \
  -d '{"instruction":"Draft a response and flag missing proof.","evidence":[{"label":"Carrier acceptance scan","text":"The carrier accepted the test parcel on November 4. The scan does not confirm delivery."}]}'
```

```json
{"source":"fixture","model":"Example draft (no model called)","draft":{"summary":"A sample draft for a merchandise or service not received dispute.","missingEvidence":["Look for delivery confirmation or a delivery scan tied to the order."],"proposedResponse":"We are reviewing the dispute. The merchant supplied these excerpts for review:\n\n[E1] Carrier acceptance scan: The carrier accepted the test parcel on November 4. The scan does not confirm delivery.","citations":["E1"]}}
```

Both outputs above were captured from a real run on Node 24.16.0 / Windows, with no credentials set.

上面两段输出是在 Node 24.16.0 / Windows 上、不配任何凭据跑出来的真实结果。

### 3. Optional: PayPal Sandbox and a model · 可选：Sandbox 与模型

```sh
cp .env.example .env        # fill in the values, keep .env out of Git · 填入取值，别把 .env 提交上去
node --env-file=.env server.mjs
```

`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` come from a Sandbox merchant app with **Customer disputes** enabled. `AI_BASE_URL` is an OpenAI-compatible base URL (the server appends `/chat/completions`), `AI_MODEL` is the model id, `AI_API_KEY` is the key. `AI_JSON_MODE=1` asks for native JSON mode when the provider supports it.

`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` 来自开启了 **Customer disputes** 的 Sandbox 商户应用。`AI_BASE_URL` 填 OpenAI 兼容的基址（服务端会补上 `/chat/completions`），`AI_MODEL` 填模型 id，`AI_API_KEY` 填密钥。上游支持原生 JSON 模式时可以加 `AI_JSON_MODE=1`。

## Documentation · 文档

| Doc · 文档 | Covers · 内容 |
|---|---|
| [DEVPOST.md](DEVPOST.md) | Project story and the 90-second recording script with timestamps.<br/>项目叙述与按时间轴写的 90 秒录制脚本。 |
| [.env.example](.env.example) | The six settings the server reads, with no values.<br/>服务端会读的六个配置项，不含实际取值。 |
| [scripts/record-demo.cjs](scripts/record-demo.cjs) | Playwright walkthrough recorder; it fails loudly if the page does not reach the expected state.<br/>Playwright 走查录制脚本；页面没到预期状态会直接报错退出。 |
| [.github/workflows/record-demo.yml](.github/workflows/record-demo.yml) | Manual `Record PayCrew demo` run in `fixture`, `fixture-live-ai` or `sandbox` mode, returning a WebM artifact.<br/>手动触发的 `Record PayCrew demo`，可选 `fixture`、`fixture-live-ai` 或 `sandbox` 模式，产出 WebM 附件。 |

## Repository layout · 仓库结构

```text
PayCrew/
├── server.mjs                     # the entire server: routing, fixtures, PayPal, model call
├── public/index.html              # the single-page UI
├── scripts/record-demo.cjs        # Playwright walkthrough + recording
├── .github/workflows/record-demo.yml
├── DEVPOST.md
├── .env.example
└── LICENSE
```

## Status · 状态

Fixture mode is exercised: the server was started, `GET /`, `GET /api/disputes`, a 404 lookup and a draft with one excerpt were called, and the non-loopback `Host` guard returned 403. Those are the outputs quoted above.

样例模式是实际跑过的：启动服务后调用了 `GET /`、`GET /api/disputes`、一次 404 查询和一次带一条摘录的草稿请求，非回环 `Host` 的拦截也确认返回 403。就是上面引用的那些输出。

Known limits, stated rather than hidden:

- **No automated tests.** There is no test file and no `package.json`; `scripts/record-demo.cjs` asserts while recording, which is not a test suite.
- **Sandbox path not verified here.** No Sandbox credentials were available in this pass, so the live dispute list and case detail calls were not exercised.
- **Live model path not verified here.** Only the no-key example draft path was run; a real provider response was not observed.
- **Review state is not persisted.** Close the tab without exporting and the edit is gone.
- **Single case at a time.** There is no queue, no assignment and no multi-user review.

已知边界写在明处：

- **没有自动化测试。** 仓库里没有测试文件，也没有 `package.json`；`scripts/record-demo.cjs` 在录制时做断言，但那不是测试套件。
- **Sandbox 路径本轮未验证。** 这次没有 Sandbox 凭据，实际争议列表与单条案子详情都没有跑过。
- **真实模型路径本轮未验证。** 只跑了无 key 的示例草稿分支，没有观察到真实上游响应。
- **复核状态不持久化。** 不导出就关标签页，修改就没了。
- **一次只处理一个案子。** 没有队列、没有分派、没有多人复核。

## License · 许可

MIT © 2026 David Wang
