# Pingen API v2 + Resend webhooks: verified technical reference

Researched 2026-10-17. Main source: the official OpenAPI 3.0 spec behind the Redoc page
(`https://api.pingen.com/documentation` loads `https://api.pingen.com/documentation/swagger-docs`, version `2.0.0`).
The staging spec (`https://api-staging.pingen.com/documentation/swagger-docs`) has exactly the same paths.
Other sources: the official Pingen Help Center and the official SDKs on github.com/pingencom.
Every claim is verified unless it is marked **NON VÉRIFIÉ**. "Probed" means I tested it myself with curl and dummy credentials.

---

## 0. Things that differ from common assumptions

- **The letter paths are now `/organisations/{organisationId}/deliveries/letters/...`, not `/organisations/{organisationId}/letters`.** The spec and all official SDKs (JS, Python, PHP, Go) use `/deliveries/letters`. The old path still answers 401 instead of 404 (probed), so it may be a legacy alias, but it is no longer documented. Use `/deliveries/letters`.
- **Pingen publishes no complete list of statuses or event codes.** The API docs FAQ says: *"We do not provide a complete list of statuses or event codes. Use webhooks to be notified of lifecycle changes in a letter."* The lists below are taken from schema examples and the Help Center.
- **France / La Poste:** delivery through La Poste only works for organisations whose **Default Destination Country = France**. Those organisations must use a **right-window** layout with its own zones (see §9.2). If the default country is something else, letters to France go through **DHL**.
- The public `delivery_product` enum contains only the "virtual" values `fast | cheap | bulk | premium | registered`. How they map to the La Poste products is **NON VÉRIFIÉ** (§10).

---

## 1. Authentication (OAuth2 client_credentials)

| Env | Token endpoint (documented) |
|---|---|
| Production | `POST https://identity.pingen.com/auth/access-tokens` |
| Staging | `POST https://identity-staging.pingen.com/auth/access-tokens` |

- Staging is a separate environment. It needs its own account (`https://identity-staging.pingen.com/auth/register`) and its own Client-ID and Secret, created under user profile > "API Access".
- Request: `Content-Type: application/x-www-form-urlencoded`. Form fields:
  - `grant_type=client_credentials`
  - `client_id=...`
  - `client_secret=...`
  - `scope=...` is optional. Several scopes are separated by spaces. If you leave it out, you get all scopes registered on the client. You can never get more scopes than the client has.
- Response:
  ```json
  { "token_type": "Bearer", "expires_in": 43200, "access_token": "..." }
  ```
  The token is valid 12 h. Client credentials give no refresh token, so request a new token when it expires.
- Use it as `Authorization: Bearer <token>`.
- Scopes listed in the spec: `letter`, `ebill`, `email`, `batch`, `template`, `webhook`, `organisation_read`.
  - Letters, file-upload flow and price calculator: `letter` (`letters.price-calculator` has security `oauth2:[letter]`).
  - Webhooks: `webhook`.
  - `GET /organisations`: `organisation_read`.
  - `GET /file-upload` declares `oauth2: []`, meaning any valid token works.
- Bad credentials (probed): HTTP 401 `{"error":"invalid_client","error_description":"Client authentication failed","message":"Client authentication failed"}`.
- The official JS SDK sends the token request to `https://api.pingen.com/auth/access-tokens` (the API host). Probing showed that host responds the same way. Still, use the documented **identity** host, which the Python and Go SDKs also use.

## 2. Base URLs

| Env | API | Identity |
|---|---|---|
| Production | `https://api.pingen.com` | `https://identity.pingen.com` |
| Staging | `https://api-staging.pingen.com` | `https://identity-staging.pingen.com` |

- Format is JSON:API. Send `Content-Type: application/vnd.api+json` on requests with a body. The SDK also sends `Accept: application/vnd.api+json`.
- Every response carries `X-Request-Id` (UUID, useful for support), `X-Ratelimit-Limit` and `X-Ratelimit-Remaining`.
- Error body:
  ```json
  { "errors": [ { "code": "string", "title": "string", "detail": "string", "source": { "pointer": "/data/attributes/x", "parameter": "string" } } ] }
  ```
- HTTP codes used: 400, 401, 403, 404, 405, 406, 409, 410, 415, 422 (validation), 424 (external dependency), 429, 500, 503 (maintenance; retry with backoff).
- Get the `organisationId` from `GET /organisations` (scope `organisation_read`). Useful organisation attributes:
  - `default_country` (e.g. "CH")
  - `default_address_position` (`left|right`)
  - `billing_currency` (`CHF|EUR|USD|GBP`)
  - `billing_mode` (`prepaid|postpaid`)
  - `data_retention_pdf` (months: 1|3|6|12)
  - `data_retention_addresses` (months: 6|12|18)
  - `limits_monthly_letters_count`

## 3. File upload (3 steps)

1. `GET /file-upload` returns:
   ```json
   { "data": { "id": "uuid", "type": "file_uploads",
       "attributes": { "url": "https://...signed...", "url_signature": "$2y$10$...", "expires_at": "2020-11-19T09:42:48+0100" },
       "links": { "self": "..." } } }
   ```
2. `PUT <attributes.url>` with the **raw PDF bytes** as the body. Per the docs: "NOT Form-Post and NO Authorization header". Example: `curl -X PUT -T file.pdf "<url>"`. The URL is a pre-signed object-storage URL that expires at `expires_at`.
3. `POST` the create-letter request with `file_url = attributes.url` (the same URL) and `file_url_signature = attributes.url_signature`.

Field limits: `file_url` maxLength 1000, `file_url_signature` maxLength 60, `file_original_name` maxLength 255.

## 4. Create letter

`POST /organisations/{organisationId}/deliveries/letters` (scope `letter`) returns **201**.

```json
{
  "data": {
    "type": "letters",
    "attributes": {
      "file_original_name": "lorem.pdf",
      "file_url": "<url from /file-upload>",
      "file_url_signature": "<url_signature>",
      "address_position": "left",
      "auto_send": false,
      "delivery_product": "fast",
      "print_mode": "simplex",
      "print_spectrum": "color",
      "meta_data": {
        "recipient": { "name": "", "street": "", "pobox": "", "number": "", "zip": "", "city": "", "country": "FR" },
        "sender":    { "name": "", "street": "", "pobox": "", "number": "", "zip": "", "city": "", "country": "FR" }
      }
    },
    "relationships": { "preset": { "data": { "id": "uuid", "type": "presets" } } }
  }
}
```

| Attribute | Required | Values / limits |
|---|---|---|
| `file_original_name` | yes | string ≤255 |
| `file_url` | yes | string ≤1000 |
| `file_url_signature` | yes | string ≤60 |
| `auto_send` | yes | boolean |
| `address_position` | no | `left` \| `right`. Default when omitted is probably the organisation's `default_address_position` (**NON VÉRIFIÉ**) |
| `delivery_product` | no* | `fast` \| `cheap` \| `bulk` \| `premium` \| `registered` |
| `print_mode` | no* | `simplex` \| `duplex` |
| `print_spectrum` | no* | `color` \| `grayscale` |
| `meta_data` | no | `recipient` and `sender` objects with: `name` ≤45, `street` ≤40, `pobox` ≤45 ("either PO box or street must be provided"), `number` ≤10, `zip` ≤8, `city` ≤25, `country` exactly 2 chars (ISO-2) |
| `relationships.preset` | no | preset UUID, used to apply automatic fixes |

\* The official JS SDK refuses `auto_send: true` unless `delivery_product`, `print_mode` and `print_spectrum` are all set. Treat them as required with auto_send.

Note on `meta_data`: the Help Center says the preset action "Address from Metadata" uses the address given "via the meta_data API attribute". Whether `meta_data` alone, without that preset, can replace the address printed in the PDF is **NON VÉRIFIÉ**. Assume the PDF must contain the address in the window zone.

**Response** (same `LetterGET` shape for create, show and send): `data` = `{ id, type:"letters", attributes, relationships, links.self, meta.abilities }`, plus `included[]`.

`attributes`:
- `status`
- `file_original_name`
- `file_pages`
- `address`: the extracted address text, e.g. `"Hans Meier\nExample street 4\n8000 Zürich\nSwitzerland"`
- `address_position`
- `country`
- `delivery_product`
- `print_mode`
- `print_spectrum`
- `price_currency`, `price_value` (number, e.g. 1.25)
- `paper_types[]`
- `fonts[]`: `{ name, is_embedded }`
- `source`: `app|api|batch|integration_email|integration_s3|integration_dropbox|integration_googledrive|integration_onedrive`
- `tracking_number`
- `submitted_at`, `created_at`, `updated_at`: format `Y-m-d\TH:i:sO`, e.g. `2020-11-19T09:42:48+0100`

`relationships`:
- `organisation`
- `events`: has `links.related.href` and `meta.count`
- `batch`

`meta.abilities.self.<ability>`: each value is `"ok" | "state" | "permission"`. Abilities: `cancel`, `delete`, `submit`, `send-simplex`, `edit`, `get-pdf-raw`, `get-pdf-validation`, `restore-original`, `change-paper-type`, `change-window-position`, `create-coverpage`, `add-attachment`, `fix-overwrite-restricted-areas`, `fix-regular-paper`, `fix-address`, `fix-interactive-content`, `fix-format`, `fix-address-position`, `apply-preset`, `create-preset`, `revalidate`, `add-to-batch`, `remove-from-batch`.

Processing is asynchronous. The FAQ says several fields stay empty right after creation, and processing can take "a few milliseconds to several minutes".

### Letter statuses

There is no official exhaustive list. The API status values below come from the `count_by_status` example in `DeliverableStatisticsAttributes`:

`accepted, action_required, awaiting_credits, cancelled_expired, cancelled, cancelling, delivered, expired, fixing, inspection, invalid, printing, processing, rejected, sent, submitted, transferring, undeliverable, unprintable, valid, validating`

Lifecycle from the Help Center ("Letter status from transfer to dispatching"). The pairing of UI labels with API values is my inference wherever the names don't match exactly.

| UI label | Likely API value | Meaning (Help Center) |
|---|---|---|
| Validating | `validating` | Document is being validated |
| Ready for Sending | `valid` | No errors; can be sent |
| Action Required | `action_required` | Fixable problem: recipient address, restricted areas, paper type, paper format, interactive elements, La Poste address checks |
| Invalid | `invalid` | Cannot be fixed; cannot be sent |
| Submitted for Sending | `submitted` | Lasts a few seconds |
| Awaiting Credits | `awaiting_credits` | Not enough credits. Resumes automatically after purchase. After 7 days it goes back to "Ready for Sending" |
| Print Preparation | `accepted` / `processing`? (**NON VÉRIFIÉ**) | Can still be cancelled |
| Cancelling / Cancelled | `cancelling` / `cancelled` | Credit refunded; a cancelled letter can be resubmitted |
| Printing | `printing` | Can no longer be cancelled |
| Unprintable | `unprintable` | Credit note issued |
| Sent | `sent` | Handed to the post. Usually the final status, because there is no delivery confirmation except for registered mail |
| Undeliverable | `undeliverable` | Returned mail |
| (registered) Delivered | `delivered` | Delivery confirmation |

Exact meaning of `fixing`, `inspection`, `transferring`, `rejected`, `expired`, `cancelled_expired`: **NON VÉRIFIÉ**.

## 5. Send letter

`PATCH /organisations/{organisationId}/deliveries/letters/{letterId}/send` (scope `letter`) returns **200** with the letter.

```json
{ "data": { "id": "<letterId>", "type": "letters",
    "attributes": { "delivery_product": "fast", "print_mode": "simplex", "print_spectrum": "color" } } }
```

- `delivery_product`, `print_mode` and `print_spectrum` are required.
- `meta_data` (same shape as in create) is optional.

Related endpoints:
- Cancel: `PATCH .../deliveries/letters/{letterId}/cancel` (no body) returns **202**. Only possible while the letter is "Submitted for Sending" or "Print Preparation".
- Delete: `DELETE .../deliveries/letters/{letterId}` returns **204**.
- Download the PDF: `GET .../deliveries/letters/{letterId}/file` returns **302**. The `Location` header is a direct storage URL.
- List: `GET .../deliveries/letters` supports `page[number]`, `page[limit]` (≤100, default 20), `sort`, `filter` (JSON), `q`, `include`, `fields[letters]`.
- A document can only be sent once. To resend, upload it again.

## 6. Price

**Price calculator:** `POST /organisations/{organisationId}/deliveries/letters/price-calculator` (scope `letter`).

```json
{ "data": { "type": "letter_price_calculator",
    "attributes": { "country": "FR", "paper_types": ["normal","normal"], "print_mode": "simplex",
                    "print_spectrum": "grayscale", "delivery_product": "cheap" } } }
```

- All attributes are required.
- `paper_types` values: `normal|qr|sepa_at|sepa_de`. The schema example `["normal","normal","qr"]` suggests one entry per page (**NON VÉRIFIÉ**).
- Response **200**:
  ```json
  { "data": { "id": "uuid", "type": "letter_price_calculator", "attributes": { "currency": "EUR", "price": 12.12 } } }
  ```
  A 202 is also listed.
- The spec's own curl sample uses `"type": "letters"`, while the schema and the JS SDK use `"letter_price_calculator"`. Use the latter.

**Price of an actual letter:** read `attributes.price_value` and `attributes.price_currency` from `GET /organisations/{organisationId}/deliveries/letters/{letterId}`. They are filled in after validation. A `cost-details` endpoint exists in the spec, but its definition is stripped from the public docs (**NON VÉRIFIÉ**).

## 7. Get letter, events, refusal reasons

- `GET /organisations/{organisationId}/deliveries/letters/{letterId}`. Params: `include`, `fields[letters]`.
- `GET /organisations/{organisationId}/deliveries/letters/{letterId}/events`. Params: `language` (default `en-GB`; other values **NON VÉRIFIÉ**), plus paging, sort, filter, q, include. Each item:
  ```json
  { "id": "uuid", "type": "letters_events",
    "attributes": { "code": "content_failed_inspection", "name": "Validation failed", "producer": "Pingen",
                    "location": "8051 Zürich, CH", "has_image": false, "data": ["..."],
                    "emitted_at": "...", "created_at": "...", "updated_at": "..." },
    "relationships": { "letter": { "data": { "id": "uuid", "type": "letters" } } } }
  ```
- Event image: `GET .../letters/{letterId}/events/{letterEventId}/image`.
- Organisation-wide event feeds: `GET /organisations/{organisationId}/deliveries/letters/events/issues`, `.../events/undeliverable`, `.../events/sent`, `.../events/delivered`.
- Event `code` values seen in the spec examples: `created`, `file_not_found`, `content_failed_inspection`, `transferred_to_distributor`, `undeliverable`, `delivered`. The full list is not published.

**How to detect a refusal:**
1. `status` is `action_required` (fixable) or `invalid` (not fixable).
2. Read the `issues` events (API feed or webhook `data.attributes.reason`).
3. Which `meta.abilities.self.fix-*` abilities are `"ok"` hints at the cause (inference):
   - `fix-address` / `fix-address-position`: address problem
   - `fix-overwrite-restricted-areas`: content in restricted areas
   - `fix-regular-paper`: paper type
   - `fix-format`: page format
   - `fix-interactive-content`: interactive elements

Issue categories documented in the Help Center (UI wording; machine codes **NON VÉRIFIÉ**):
- **Action required (fixable):**
  - Issue with recipient address: no well-structured address found, address outside the Address Area, or content in the Postage Area
  - Content in restricted areas
  - Invalid paper type
  - Pages in invalid paper format (not A4 portrait)
  - PDF contains interactive elements (form fields, annotations, notes, multimedia)
  - For French organisations since 2025-03-01: postcode line invalid, insufficient address lines (<3), postcode not 5 digits, unsupported ISO prefix (`FR-75001`), city/country not in capitals, city missing after postcode, country on the postcode line, invalid address structure (blank lines, or lines after postcode/city other than the country), distracting elements below the address
- **Not available for sending (invalid):**
  - Already submitted before
  - Too many pages for the destination
  - Unable to process the PDF (corrupt or protected)
  - Invalid paper format
  - PDF removed for privacy reasons (retention)
  - Exceeds 8 MB
  - File not found
  - Invalid PDF binary content (must start with `%PDF-x.y` and end with `%%EOF`)
  - Belongs to a batch
- **Undeliverable reasons** (returned mail): address wrong or invalid, recipient moved, recipient deceased, no letterbox in the recipient's name.

## 8. Webhooks

**Create:** `POST /organisations/{organisationId}/webhooks` (scope `webhook`) returns **201**.

```json
{ "data": { "type": "webhooks",
    "attributes": { "event_category": "issues", "url": "https://...", "signing_key": "d09a095a0d1d2ae896f985c0fff1ad51" } } }
```

- `event_category`: `issues` | `sent` | `undeliverable` | `delivered` | `channel_subscriptions`. Create one webhook per category.
- `url`: max 200 chars, must be reachable on port 443 (Help Center).
- `signing_key`: you choose it; **minLength 20, maxLength 32**.
- Other endpoints: list `GET /organisations/{organisationId}/webhooks`, get `GET .../webhooks/{webhookId}`, delete `DELETE .../webhooks/{webhookId}`.
- Endpoints that exist in the spec but are undocumented: `POST .../webhooks/{id}/requests/send-test`, `.../requests`, `.../retry-failed`.

**What each category covers** (Help Center):
- issues: letter processing problems such as not A4, restricted areas, insufficient credits
- sent: handed to the post, or a postal tracking ID received
- undeliverable: returned mail
- delivered: delivery confirmation, e.g. registered mail

**Signature** (API docs, confirmed in the JS, Python and PHP SDKs):
- HTTP header **`Signature`**: lowercase **hex** of **HMAC-SHA256(key = signing_key, message = raw request body)**.
- Verify against the raw body bytes before parsing the JSON, and compare in constant time. There is no timestamp or replay protection, so deduplicate on `data.id` / event id yourself.
- Node.js:
  ```ts
  createHmac('sha256', signingKey).update(rawBody).digest('hex') === req.headers['signature']
  ```

**Delivery and retries:**
- Any HTTP 2xx counts as success.
- Otherwise Pingen retries after 1 min, 5 min, 10 min, 1 h, 2 h, 4 h, then gives up. The Help Center says "retries up to 7 times".
- Failed requests can be resent from the WebApp.

**Payload** (`Content-Type: application/vnd.api+json`):

```json
{ "data": { "id": "uuid", "type": "webhook_issues",
    "attributes": { "reason": "Content failed inspection", "url": "https://your.webhook/url", "created_at": "2020-11-19T09:42:48+0100" },
    "relationships": {
      "organisation": { "data": { "id": "uuid", "type": "organisations" }, "links": { "related": "..." } },
      "deliverable":  { "data": { "id": "uuid", "type": "letters" },       "links": { "related": "..." } },
      "event":        { "data": { "id": "uuid", "type": "deliverables_events" }, "links": { "related": "..." } } },
    "links": { "self": "..." } },
  "included": [ ] }
```

| Category | `data.type` | Extra attributes |
|---|---|---|
| issues | `webhook_issues` | `reason` |
| sent | `webhook_sent` | none |
| undeliverable | `webhook_undeliverable` | `reason`, `corrected_address { name, street, number, zip, city }` |
| delivered | `webhook_delivered` | none |

- `relationships.deliverable.data.type` is one of `letters|emails|ebills`.
- **Caveat:** the current spec names the relationship `deliverable`, but the official JS and PHP SDK types still read `relationships.letter`. Handle both: `deliverable ?? letter`.
- What `included[]` contains is **NON VÉRIFIÉ**. To be safe, fetch the letter with `GET` after receiving the webhook.

## 9. PDF requirements

### 9.1 General rules (all organisations)

- **Page format:** A4 portrait, 210 × 297 mm, on every page. Landscape pages or US Letter put the letter in `action_required`; they can be fixed with "Convert to A4".
- **File size:** max **8 MB**.
- **Max pages per letter:**

  | Destination | Max pages |
  |---|---|
  | France, Germany, Austria, Belgium, Luxembourg | 320 |
  | Switzerland, rest of world | 120 |
  | Spain | 150 |
  | Netherlands | 14 |
  | India | 16 |
  | United Kingdom | 500 (Help Center; the marketing page says 120) |

  The marketing page notes these counts are "based on duplex print".
- **Fonts:** must be embedded. Validation checks "Fonts are correctly embedded", and the letter exposes `fonts[].is_embedded`.
- **No interactive content:** no forms, annotations or multimedia. Flatten the PDF.
- **Valid binary:** starts with `%PDF-`, ends with `%%EOF`, not encrypted or protected.
- **Address formatting:** font 10–12 pt regular (min 9 pt), left-aligned, no blank lines. The address box has a 3 mm safety margin. The Address Area must contain only the address.

### 9.2 Window and zone coordinates (1st page; x from the left edge, y from the top edge, in mm)

**Organisations whose Default Destination Country is NOT France** (Help Center "Layout requirements"):

| Zone | `address_position: left` | `address_position: right` |
|---|---|---|
| Address area | x 22, y 60, **85.5 × 25.5** | x 118, y 60, **85.5 × 25.5** |
| Postage area (keep empty) | x 20, y 40, **89.5 × 47.5** | x 116, y 40, **89.5 × 47.5** |
| Restricted areas (every page) | 5 mm from each edge + 15 mm in the bottom-left corner | same |

**Organisations whose Default Destination Country IS France** (Help Center "Layout requirements (French Organisations)"). **Right window only.** These rules apply to letters going to France through La Poste:

| Zone | Value |
|---|---|
| Address area | x **110**, y **50**, **80 × 28** mm |
| Postage area / La Poste safe zone (20 mm around the address area; only the franking may go there) | x **90**, y **30**, **115 × 64** mm |
| Restricted areas (every page) | 5 mm from each edge + **20 mm in the top-right corner** |

International letters sent by a French organisation are printed abroad and must follow the general (non-French) layout.

Official Word templates:
- `https://pingen2-website.objects.lpg.cloudscale.ch/public/fde9edf6e60a43398a2553727d2acb95/letter-template-window-left.docx`
- `.../letter-template-window-right.docx`
- `.../letter-template-france.docx`

QR, barcode or other Pingen-specific keep-free zones: none documented beyond the zones above (**NON VÉRIFIÉ** whether others exist).

### 9.3 Country line

- The destination country name must be the **only content of the last address line**, spelled as in Pingen's supported list. For FR the list gives `France`. Use the country **name**, not the ISO code. Case-insensitivity is **NON VÉRIFIÉ**; La Poste wants it in capitals, e.g. `FRANCE`.
- **Exception:** if the destination equals the organisation's Default Destination Country (allowed for DE, CH, AT, NL, BE, LU, FR, UK, ES, IN), the country may be omitted. For Germany it *must* be omitted. If no country is detected, Pingen validates the letter against the default country.
- Never put an ISO prefix such as `FR-75001` or `CH-1234`.

### 9.4 La Poste address rules (letters to France)

- 3 to 6 lines, **max 38 characters per line** including spaces, left-aligned.
- No underlining, frames or blank lines.
- Line order:
  1. Name (salutation optional)
  2. Complement: apartment, floor
  3. Complement: building entrance, industrial zone
  4. Number and street
  5. BP / TSA / CEDEX reference
  6. `75001 PARIS`
  7. Optional `FRANCE`
- Postcode line: 5-digit postcode, one space, city in capitals, nothing else.
- No punctuation (`. , -`) on the street line and the lines after it.
- Fonts: black, sans-serif, not bold or italic. Recommended: OCR-A/B, Courier, Verdana, Helvetica, Arial, etc. at 9–12 pt.
- Character height 1.8–5.0 mm; character spacing 0.3–2.0 mm; word spacing 1.0–2.0 mm; line spacing 1.0–2.5 mm.
- Keep 20 mm clear around the address area.

## 10. Delivery products, print options

- **API values (`delivery_product`), virtual:** `fast`, `cheap`, `bulk`, `premium`, `registered`. API FAQ: *"Virtual delivery products work for a letter which is sent into any country. We automatically choose the most appropriate delivery product."*
- Concrete product codes also exist. For example `postag_a` (Swiss A-Post) appears in batch-send samples. **The concrete codes for France are NON VÉRIFIÉ.**
- **France (La Poste)** products per the Help Center:

  | Product | Delivery time | Tracking ID | Delivery confirmation | Signed receipt | Undeliverable alert |
  |---|---|---|---|---|---|
  | Lettre verte | 3–4 business days | no | no | no | yes |
  | Recommandé | 2–3 business days | yes | yes | no | yes |
  | Recommandé AR | 2–3 business days | yes | yes | yes | yes |

  - Cut-off: 12:00 CE(S)T, with printing and handover the same business day. No printing on weekends or holidays.
  - Mapping (inference, **NON VÉRIFIÉ**): `cheap`/`fast` probably map to Lettre verte and `registered` to Recommandé. Whether Recommandé AR can be selected through the API is **NON VÉRIFIÉ**. Check on staging with the price calculator before relying on it.
- `print_mode`: `simplex` | `duplex`. Special paper types (payment slips) cannot be printed duplex, and must sit on odd pages.
- `print_spectrum`: `color` | `grayscale`.
- `paper_types`: `normal` | `qr` (Swiss QR-bill) | `sepa_at` | `sepa_de`.

## 11. Rate limits, idempotency, sandbox

- **Rate limit:** 300 requests/min per user (docs). An unauthenticated docs page returned `x-ratelimit-limit: 900` when probed, so read the headers.
  - On **429**, wait for `Retry-After` (seconds) or `X-Rate-Limit-Reset` (timestamp).
  - On **503** (maintenance), retry with backoff, e.g. 1 s, 5 s, 10 s, 15 s.
- **Idempotency:** send `Idempotency-Key: <1–64 chars, UUIDv4 suggested>` on any POST or PATCH.
  - A replayed response returns the original status and body with `Idempotent-Replayed: true`.
  - Keys are cached for **24 h**.
  - Reusing a key while the first request is still running gives an error (409 conflict). Wait a few seconds before retrying.
  - The official JS SDK sends one key per logical call and reuses it across retries.
- **Staging simulation by file name** (no real printing):
  - `*_simulate_undeliverable.pdf`: ends undeliverable
  - `*_simulate_unprintable.pdf`: rejected by the print centre
  - `*_simulate_cancellable.pdf`: stops in a state where it can still be cancelled
  - any other name: goes through to "sent"
- **Monthly Send Limit:** an organisation setting. When reached, letters stay "Ready for Sending". It is checked once per minute.

## Sources (Pingen)

- https://api.pingen.com/documentation (Redoc), spec at https://api.pingen.com/documentation/swagger-docs (also on api-staging)
- https://help.pingen.com/en/templates-and-postal-requirements/layout-requirements
- https://help.pingen.com/en/templates-and-postal-requirements/layout-requirements-french-organisations
- https://help.pingen.com/en/templates-and-postal-requirements/letter-standards
- https://help.pingen.com/en/templates-and-postal-requirements/address-requirements-la-poste
- https://help.pingen.com/en/templates-and-postal-requirements/supported-country-names
- https://help.pingen.com/en/getting-started/standard-recipient-country
- https://help.pingen.com/en/getting-started/letter-status-from-transfer-to-dispatching
- https://help.pingen.com/en/transfer-letters/sending-issues
- https://help.pingen.com/en/fix-and-enhance-letters/ (issue-with-recipient-address, content-in-restricted-areas, pages-in-invalid-paper-format, pdf-contains-interactive-elements, invalid-paper-type)
- https://help.pingen.com/en/submit-and-send-letters/shipping-options-france
- https://help.pingen.com/en/submit-and-send-letters/introduction-delivery-products
- https://help.pingen.com/en/submit-and-send-letters/introduction-cut-off-times
- https://help.pingen.com/en/submit-and-send-letters/cancel-letters
- https://help.pingen.com/en/api-and-integrations/create-and-manage-webhooks
- https://help.pingen.com/en/presets/introduction-presets
- https://www.pingen.com/en/print-delivery-options/
- https://www.pingen.com/en/address-formats/address-example-france
- https://github.com/pingencom/pingen2-sdk-js (src/oauth.ts, src/requestor.ts, src/webhook.ts, src/resources/letters/letters.ts, src/resources/file-upload.ts, src/utils/retry.ts)
- https://github.com/pingencom/pingen2-sdk-python (pingen2sdk/__init__.py, pingen2sdk/incoming_webhook.py)
- https://github.com/pingencom/pingen2-sdk-php (src/IncomingWebhook/IncomingWebhook.php)
- https://github.com/pingencom/pingen2-sdk-go (config/config.go)

---

# Resend

## Webhook signature verification (Svix)

- **Headers:**
  - `svix-id`: unique message id. It stays the same across retries, so use it for deduplication.
  - `svix-timestamp`: Unix seconds.
  - `svix-signature`: a space-separated list of `v<version>,<base64 sig>`, e.g. `v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=`. Usually there is one entry, but there can be several.
- **Secret:** `whsec_<base64>`. It is shown on the webhook details page and returned as `signing_secret` by the create, get and list webhook API calls. The HMAC key is the **base64-decoded part after `whsec_`**.
- **Signed content:** `` `${svix_id}.${svix_timestamp}.${rawBody}` ``. Use the raw body, never re-stringified JSON.
- **Algorithm:** HMAC-SHA256, digest encoded in **standard base64**.
  - Compare against every `v1,` entry in the header, after removing the `v1,` prefix, using a constant-time comparison.
  - Check the timestamp tolerance. The Svix/standard-webhooks library uses **5 minutes**, both in the past and in the future.
  ```ts
  const key = Buffer.from(secret.split('_')[1], 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64');
  const ok = sigHeader.split(' ').some(s => { const [v, sig] = s.split(','); return v === 'v1' && timingSafeEqualStr(sig, expected); });
  ```
- **SDK shortcut:**
  ```ts
  resend.webhooks.verify({ payload: rawBody, headers: { id, timestamp, signature }, webhookSecret })
  ```
  It throws if the request is invalid. Alternatively use `new Webhook(secret).verify(rawBody, headers)` from the `svix` package.
- **Delivery:**
  - Respond **HTTP 200** to acknowledge.
  - Delivery is **at-least-once**: deduplicate on `svix-id` and order events by the payload's `created_at`.
  - Retry schedule: immediately, then 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h.
  - Endpoints that keep failing are disabled automatically and the team gets an email. Messages can be replayed manually.

## Email event types

| Event | Fires when |
|---|---|
| `email.sent` | API request accepted; Resend will attempt delivery |
| `email.delivered` | Delivered to the recipient's mail server |
| `email.delivery_delayed` | Temporary delivery problem |
| `email.bounced` | Permanently rejected by the recipient server |
| `email.complained` | Delivered but marked as spam |
| `email.opened` | Opened. Needs open tracking, which is **disabled by default per domain** |
| `email.clicked` | Link clicked. Needs click tracking, same default |
| `email.failed` | Failed to send: invalid recipient, API key, domain verification, quota… |
| `email.scheduled` | Scheduled for sending |
| `email.suppressed` | Suppressed by Resend (address on a suppression list) |
| `email.received` | Inbound email received |

Other families (not needed here): `domain.created|updated|deleted`, `contact.created|updated|deleted`, `contact.topics.updated`, `suppression.added|removed`, `topic.*`, `inbox.*` (beta).

## Payload shape

```json
{
  "type": "email.bounced",
  "created_at": "2026-11-22T23:41:12.126Z",
  "data": {
    "broadcast_id": "uuid",
    "created_at": "2026-11-22T23:41:11.894Z",
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "message_id": "<111-222-333@email.example.com>",
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Sending this example",
    "template_id": "uuid",
    "tags": { "category": "confirm_email" },
    "bounce": { "message": "...", "subType": "Suppressed", "type": "Permanent", "diagnosticCode": ["smtp; 550 ..."] }
  }
}
```

- Top level: `type`, `created_at` (ISO 8601, time the event was created), `data`.
- `data.email_id` is the id returned when the email was sent. Use it to join the event to your `Envoi` record.
- Fields common to all email events: `broadcast_id` (if applicable), `created_at`, `email_id`, `message_id`, `from`, `to[]`, `subject`, `template_id` (if applicable), `tags` (`Record<string,string>`).
- Event-specific fields:
  - `email.bounced`: `data.bounce { message, subType, type, diagnosticCode[] }`
  - `email.clicked`: `data.click { ipAddress, link, timestamp, userAgent }`
  - `email.failed`: `data.failed { reason }`, e.g. `reached_daily_quota`
  - `email.suppressed`: `data.suppressed { message, type }`, e.g. `OnAccountSuppressionList`. These fields come from the docs example only.
  - `email.sent`, `delivered`, `delivery_delayed`, `complained`, `opened`: common fields only.

## Sources (Resend / Svix)

- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://resend.com/docs/webhooks/event-types
- https://resend.com/docs/webhooks/emails/sent, /delivered, /delivery-delayed, /bounced, /complained, /opened, /clicked, /failed, /suppressed
- https://resend.com/docs/webhooks/retries-and-replays
- https://resend.com/docs/webhooks/create-webhook
- https://resend.com/docs/api-reference/webhooks/create-webhook (`signing_secret: "whsec_..."`)
- https://resend.com/docs/dashboard/domains/tracking
- https://docs.svix.com/receiving/verifying-payloads/how-manual
- https://github.com/standard-webhooks/standard-webhooks/blob/main/libraries/javascript/src/index.ts (5-minute tolerance, `v1` parsing)
