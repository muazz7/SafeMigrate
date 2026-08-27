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
