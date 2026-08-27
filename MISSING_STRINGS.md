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
| `errors.cancelled` | *(no fallback yet — user-cancelled picker, currently silent)* |

## Not yet written — needed by the day shown

These have no entry in either language yet. Listed so the developer can prepare copy
ahead of the day that needs it.

- **Day 5 — the rules engine copy. The largest and most important block.**
  For each of `R01`–`R14` and `I01`–`I03`: `rules.<id>.title`, `.explain`, `.action`.
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
