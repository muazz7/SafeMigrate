# Missing Bangla strings

Per BUILD-SPEC §0 rule 3, **no Bangla is ever invented or machine-translated.** Every
key below currently renders its **English fallback** and needs the developer's Bangla
copy in `data/strings.json` under the `bn` tree.

The Bangla already in `strings.json` was transcribed verbatim from `BUILD-SPEC-v3.md`
and nowhere else.

---

## Awaiting Bangla copy — as of Day 1

| Key | English fallback in use |
|---|---|
| `app.tagline` | Check your work contract before you sign or pay. |
| `home.scan_title` | Contract Scanner |
| `home.scan_desc` | Photograph your contract and hear what it says. |
| `home.agency_title` | Agency Verifier |
| `home.agency_desc` | Check whether a recruiting agency is licensed. |
| `home.cost_title` | Cost Checker |
| `home.cost_desc` | Compare what you were asked to pay with the legal limit. |
| `home.vault_title` | Documents |
| `home.vault_desc` | Keep proof of what you paid and signed. |
| `common.disclaimer` | This app flags possible risks for you to check with a person. It is not legal advice and does not decide whether a document is fraudulent. |
| `common.language_toggle` | English |
| `errors.generic` | Something went wrong. Please try again. |
| `errors.unsupported_type` | That file type is not supported. Use JPG, PNG, WEBP, or PDF. |
| `errors.camera_denied` | Camera permission is needed to photograph your document. |
| `errors.cancelled` | Cancelled. *(never rendered — a cancelled picker is silent)* |

### Added Day 2 — scan flow

| Key | English fallback in use |
|---|---|
| `scan.optional` | Optional |
| `scan.doc_type_label` | What is this document? |
| `scan.doc_type.contract` / `.demand_letter` / `.receipt` / `.other` | Contract / Demand letter / Receipt / Other |
| `scan.photo_tips` | Good light, page flat, whole page in the frame, no shadow across the text. |
| `scan.preview_alt` | The document you selected |
| `scan.pdf_selected` | PDF selected |
| `scan.retake` | Take again |
| `scan.confirm` | Continue |
| `scan.camera_why_title` | Why the camera is needed |
| ~~`scan.camera_why_body`~~ | ✅ **Bangla supplied by the developer on Day 5.** Wording revised so it no longer promises that nothing is stored — the document IS stored, and the Vault depends on that. See DEVIATIONS D12b. |
| `scan.camera_denied_help` | Camera permission is turned off. Turn it on in Settings → Apps → SafeMigrate → Permissions, or choose an existing file instead. |
| `scan.progress.uploading` | Sending your document |
| `scan.progress.reading` | Reading the document |
| `scan.progress.checking` | Checking the terms |
| `scan.progress.done` | Done |
| `common.cancel` / `.close` / `.continue` / `.retry` | Cancel / Close / Continue / Try again |
| `common.open_settings` | Open settings |
| `common.exit_confirm` | Close the app? |
| `common.stay` / `common.exit` | Stay / Close |

> `scan.camera_why_body` is worth writing carefully. It is shown **before** the Android
> permission dialog, and it is the sentence that decides whether a cautious user grants
> camera access or denies it and never gets past the first screen.

## Not yet written — needed by the day shown

These have no entry in either language yet. Listed so the developer can prepare copy
ahead of the day that needs it.

- **Day 5 — the rules engine copy. THE BLOCKER for the results screen.**
  The engine is built and emits these keys today; every finding currently renders its
  raw key. For each of `R01`–`R14` and `I01`–`I03`: `rules.<id>.title`,
  `rules.<id>.explain`, `rules.<id>.action` — **51 strings**.
  Each rule's JSDoc in `src/lib/rules.ts` states what it checks and why it matters; that
  is the source material for the Bangla copy.
  - `R01` needs the deliberately gentler tone described in §8.4: acknowledge that the
    practice is common and that employers have a stated reason, then give the
    destination-country legal position, then one concrete action (get a written
    return-on-request line added). **Tone is gentle; severity stays critical.**
  - `I02` must read as a neutral note, never as a warning.
- **Day 5** — progress steps (uploading / reading / checking / done), photo-quality
  recovery tips, "১৪টি বিষয় পরীক্ষা করা হয়েছে…" transparency line variants.
- **Day 6** — the four agency states, and the "কীভাবে চিনবেন" checklist items.
- **Day 7** — cost checker labels, the 12 country names in Bangla.
- **Day 8** — the complaint letter template, 64 district names, form field labels.

---

## Added Day 5 — results screen

Every key below renders its **English fallback** today. The results UI is complete and
testable; it is the Bangla that is outstanding.

### The rules copy — 51 strings, the largest remaining block

`rules.<id>.title`, `rules.<id>.explain`, `rules.<id>.action` for **R01–R14** and
**I01–I03**. English is written for all 51 and is a faithful basis for translation —
each rule's JSDoc in `src/lib/rules.ts` explains what it checks and why.

Two need particular care:

- **`rules.R01.*`** — passport confiscation. The tone is deliberately gentler than every
  other rule: acknowledge that the practice is common and that employers give a reason,
  then state the destination-country legal position, then one concrete action. The
  severity stays **critical** regardless of how gentle the wording is.
- **`rules.I02.*`** — documented safekeeping. Must read as a calm note, never a warning.
  It is styled neutrally (blue, circled-i, grouped under `জানিয়ে রাখা হচ্ছে`) and the
  Bangla must match that register.

### Results screen chrome

| Key | English fallback in use |
|---|---|
| `severity.critical` / `.high` / `.medium` / `.info` | Very serious / Serious / Worth checking / For information |
| `result.verdict_count` | {{count}} things found |
| `result.verdict_none` | Nothing of concern was found |
| `result.speak_all` / `result.speak_this` | Listen to all of this / Listen |
| `result.stop_speaking` | Stop |
| `result.what_was_checked` | What was checked |
| `result.next_actions` | What you can do next |
| `result.ceiling_label` / `.demanded_label` / `.average_label` | Government limit / Asked of you / National average paid |
| `result.no_evidence` | This check is based on what the contract does not say… |
| `result.low_confidence_title` / `.low_confidence_body` | The document was hard to read / … |
| `result.failed_title` / `.failed_body` | This document could not be read / … |
| `result.not_found_title` / `.not_found_body` | This result is no longer available / … |
| `result.retake` / `result.back_to_scan` | Take the photo again / Scan a document |
| `computed.*` (18 keys) | Labels for the numbers shown on each card |

**Already in Bangla** (transcribed from the spec, with values interpolated):
`result.checked_summary` — "{{checked}}টি বিষয় পরীক্ষা করা হয়েছে, {{skipped}}টি তথ্যের
অভাবে পরীক্ষা করা যায়নি" · `result.multiple_of_ceiling` — "সরকারি সীমার {{multiple}} গুণ"

---

## Added Day 6 — Agency Verifier

38 keys under `agency.*`, all rendering English fallbacks. Already in Bangla from the
spec: `agency.stop_before_paying` (টাকা দেওয়ার আগে থামুন) and
`agency.how_to_spot_heading` (কীভাবে চিনবেন).

| Group | Keys | Notes |
|---|---|---|
| Search | `search_label` `search_hint` `search_placeholder` `search_button` | |
| Empty / counts | `empty_title` `empty_body` `results_one` `results_many` | |
| Record fields | `rl_number` `valid_until` `district` `baira_member` `baira_not_member` `baira_unknown` | |
| Four states | `state_active_*` `state_expired_*` `state_suspended_*` `state_cancelled_*` `state_not_found_*` | title + body each |
| Cautions | `licence_alone_warning` `verify_in_person` `not_found_action` | |
| Checklist | `legit_heading` `fraud_heading` `legit.1–7` `fraud.1–8` `checklist_note` | 15 list items |
| Provenance | `source_line` `stub_warning` | |

Three need the most care in translation:

- **`state_not_found_body`** — must say plainly that absence from our copy of the list is
  not proof the agency is fake, while still being a firm reason to stop and check in
  person. Too soft and it is useless; too hard and the app is accusing a legitimate
  agency on incomplete data.
- **`licence_alone_warning`** — the point is that a number on a signboard proves nothing;
  what matters is that the *status* reads active.
- **`checklist_note`** — the app must never read as though it decides whether an agency
  is honest (§16.8). The wording keeps that judgement with the DEMO office.
