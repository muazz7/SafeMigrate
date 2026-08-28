# Deviations from BUILD-SPEC-v3.md

Every departure from the spec, with its reason. Per §0 rule 9, developer instructions
override the spec — those are logged here too.

---

## Day 1

### D1 — Next.js 16 / React 19 / Tailwind 4 instead of "Next.js 14+"
**Spec:** §3 "Next.js 14+, App Router, TypeScript strict" · "Tailwind CSS".
**Actual:** Next.js 16.3.3, React 19.2.8, Tailwind 4.
**Reason:** `create-next-app@latest` current stable; "14+" permits it. Tailwind 4 has no
`tailwind.config.ts` — the §6 design tokens live in an `@theme` block in `globals.css`
instead, which is the same idea in the framework's current form.
**Verified:** both builds pass; static export and the APK work.

### D2 — `ceiling_bdt` is nullable
**Spec:** §5.3 / §8.4 R02 imply a plain number.
**Actual:** `number | null` in `types/index.ts` and `data/cost-ceilings.json`.
**Reason:** a placeholder `0` for an unknown ceiling would make R02 fire **critical** on
every fee above zero — a false critical on a safety tool. `null` means "not known" and
R02 skips, which is the correct behaviour under §8.4 ("returning null when it cannot be
evaluated"). This tightens rather than softens a safety rule, so §16.9 is respected.

### D3 — Extra `platform.ts` methods beyond the §9 interface
**Spec:** §9 lists `capturePhoto`, `pickFile`, `speak`, `stopSpeaking`, `canSpeak`,
`outputDocument`, `getItem`, `setItem`, `removeItem`.
**Actual:** also `copyToClipboard`, `initNativeChrome`, `onHardwareBack`.
**Reason:** §9.2 explicitly instructs adding a method to `platform.ts` rather than
branching on platform inside a component. Copy-to-clipboard is required by §10.7, status
bar/splash by §6, and the hardware back handler by §9.1 — each needs a platform branch,
so each belongs here.

### D4 — `@capacitor/app` added to the dependency list
**Spec:** §3 lists the Capacitor plugins without `@capacitor/app`.
**Reason:** §9.1 requires a hardware back-button listener, which that plugin provides.
Not a UI kit or forbidden dependency.

### D5 — `src/lib/reference-data.ts` added (not in the §4 file map)
**Reason:** Day 1 task 7 requires "build-time validation" of `data/*.json`. Centralising
the zod validation in one module keeps `agencies.ts` and `cost.ts` (Days 6–7) to pure
lookup logic, and a malformed data file fails the build rather than showing a wrong
number at the fair.

### D6 — `scripts/android-env.sh` added
**Reason:** this machine's default `java` is JDK 25; Capacitor 6 and AGP need JDK 17
(§2.1). The script pins `JAVA_HOME` and `ANDROID_HOME` for the build rather than
changing the developer's system default and breaking their other projects.

### D7 — RLS is deny-all rather than header-matched
**Spec:** §5.1 "allow insert/select where `session_id` matches the request's
`x-session-id` header".
**Actual:** RLS enabled with **no** permissive policies; all access goes through server
routes using the service-role key.
**Reason:** a header-matched policy is trivially forgeable from a browser and would let
the anon key reach the tables directly. Deny-all means the browser and the APK cannot
query contracts at all. Session isolation is still enforced — in the server routes,
where it can't be spoofed by editing a request header. Same guarantee as the spec
intends, strictly stronger boundary. **To be documented in README under "Known
limitations" (§16.7) on Day 10.**

---

## Day 2

### D8 — API route handlers are named `route.api.ts`, not `route.ts`
**Spec:** §4 file map shows `api/extract/route.ts`.
**Actual:** `api/extract/route.api.ts`, with `pageExtensions` in `next.config.mjs` set to
`['tsx','ts','api.ts']` for web and `['tsx','ts']` for native.
**Reason:** required to make §4.1 actually build. `output: 'export'` fails with
"Failed to collect page data for /api/extract" as soon as a route handler is real
(imports `node:crypto`, uses `force-dynamic`). Registering the `api.ts` extension only
for the web target means the native build never resolves the route at all, so the export
succeeds and the APK ships zero server code — which is exactly the outcome §4.1 wants.
**Verified:** `/api/extract` present in the web build, absent from `out/`.

> A trivial placeholder route DOES export without complaint, so this failure only
> appears once the route does real work. Worth knowing before adding `/api/analyze`
> and `/api/agency` — name them `route.api.ts` from the start.

### D9 — `src/lib/back-stack.ts` added (not in the §4 file map)
**Reason:** §9.1 requires back to close a modal before navigating. Components need a way
to register an interceptor without importing Capacitor (§9.2 forbids that), so the
registry lives here and AppShell owns the single platform listener.

### D10 — Debug-only Android network security config
**Added:** `android/app/src/debug/{AndroidManifest.xml,res/xml/network_security_config.xml}`.
**Reason:** permits cleartext to `10.0.2.2` so the emulator can reach `next dev` during
development. Lives in the `debug` source set, so it is **never merged into a release
APK** — release keeps `usesCleartextTraffic="false"`. Not a production behaviour change.

### D11 — `platform.exitApp()` added
**Reason:** §9.1's "prompts before exiting" needs the confirm sheet's button to actually
close the app. Same rationale as D3 — a platform branch belongs in `platform.ts`.

### D12b — ⚠️ `scan.camera_why_body` claims nothing is stored, but documents ARE stored
**Supplied by the developer (§0 rule 9, so it is in place):**
> "চুক্তির ছবি তুলতে এবং যাচাই করতে ক্যামেরা ব্যবহারের অনুমতি দিন। আপনার কোনো তথ্য বা ছবি
> সংরক্ষণ করা হবে না।" — "…None of your information or photos will be stored."

**The conflict:** `/api/extract` uploads the image to the Supabase `documents` bucket and
inserts a `documents` row. The Vault (§10.6) exists precisely so the worker keeps a
timestamped copy of what they signed. So the sentence is not accurate as the system is
built.

**Why it matters more than a wording nit:** §16 privacy is directly scored, and §16.8
requires the app never overclaim. A false privacy promise on a migrant-safety tool is the
kind of thing a domain judge tests by asking "so where does my photo go?". It is also the
one claim a user might rely on when deciding to photograph a sensitive document.

**Options, developer's call:**
1. Reword to what is true — e.g. the photo is stored privately, only the worker's session
   can reach it, and it can be deleted from the Vault at any time.
2. Keep the sentence and make it true by not persisting (this removes the Vault).

**RESOLVED (Day 5).** The developer chose option 1 and supplied revised Bangla: the
document stays private and can be deleted from the Vault at any time. No promise that
nothing is stored, so the copy now matches what the system does.

### D13 — `analyze()` input carries `confidence` and `today`
**Spec:** §8.1 lists six input fields, none of them confidence or a date.
**Reason:** §8.4 requires I01 to fire on `confidence < 0.6`, and R03 to fire when
`valid_until` has passed — neither is computable from the six listed fields. `today` is
injected rather than read from the clock so the engine stays pure and its tests stay
deterministic, which §8 treats as the whole point of the file.

### D14 — Rules expose an `evaluable` predicate alongside `Finding | null`
**Spec:** §8.4 "returning null when it cannot be evaluated or does not fire".
**Reason:** that signature conflates "checked, and fine" with "could not check", but §8.1
requires a `skippedCount` and §10.3 renders it to the user. Each rule keeps the exact
`(input) => Finding | null` signature the spec names; a parallel `evaluable` predicate in
the `RULES` registry supplies the count. Without it, a document missing half its fields
would report as thoroughly checked.

### D15 — Readability guard before any rule runs
**Added:** `isDocumentReadable()` — if no substantive field was extracted, every rule
reports "not evaluated" instead of running.
**Reason:** R07/R09/R13 fire on nulls by design (silence about a return ticket IS the
warning). On a blurred photo where every field is null, that same logic would manufacture
warnings from an unread page — wrong, and it would discredit every genuine flag beside
it. §8.5 requires "empty contract → 0 findings", which is unreachable otherwise.
**Not a softening (§16.9):** no severity or condition is weakened; skipped checks are
counted and surfaced, and I01/I03 tell the user to re-photograph.

### D16 — R03 skips when the document names no agency
**Reason:** §8.4 says R03 fires when `agencyMatch === null`, which taken literally emits a
critical "agency not licensed" for a contract that never mentions an agency. There is
nothing to verify in that case, so the rule reports "not evaluated". A named agency that
is absent from the list still fires critical, unchanged.

### D17 — `quoted_clauses` keyed by topic, not by rule id
**Spec:** §7.2 describes `quoted_clauses` as mapping a rule id to its source sentence.
**Actual:** the prompt asks for plain topic keys ("passport", "salary"); `rules.ts` maps
each rule to its topics when attaching evidence, and still accepts a rule id if present.
**Reason:** telling the model our rule ids would teach it the rule set, which is exactly
the coupling §8 exists to prevent — the claim that the model cannot invent a violation
holds only while it has never been shown one. Evidence still reaches every finding.

### D12 — Minimal custom Capacitor plugin: `AppSettingsPlugin.java`
**Spec:** §15 requires "a button opening app settings" when camera permission is denied.
**Reason:** Capacitor 6 ships no first-party plugin for this, and Android only allows
re-granting a permanently denied permission from the system settings page. ~25 lines of
Java plus a `registerPlugin` call. The UI also shows written instructions and offers the
file-picker path, so a failure here still leaves the user a way forward.
