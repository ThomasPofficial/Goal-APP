# My School Search Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a name-search input to the Staff, Alumni Network, and Students sections of `/my-school` so long rosters are easy to filter when picking people for a partnership request.

**Architecture:** Pure client-side filtering inside the existing `SchoolHubClient.tsx` component. Three independent `useState<string>` query strings (one per section), each filtering the array already passed in as props via case-insensitive `displayName.includes()`. A small shared `SearchInput` presentational component is introduced and reused across all three sections. No new files, no API changes, no new dependencies.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, inline styles (existing convention in this file), `lucide-react` icons.

## Global Constraints

- Search matches `displayName` only — no other fields (per spec, "Non-goals").
- No debounce, no fuzzy matching — plain `.toLowerCase().includes()` per keystroke.
- Mentor Spotlight section is explicitly out of scope — do not add search there.
- Search must never affect `selectMode` / `selected` state — filtering only changes which cards render; checked cards stay checked and stay counted even when filtered out of view.
- Alumni Network search must compose with (not replace) the existing All/Mentors toggle: toggle filters first, then search filters the toggle's result.
- Follow the file's existing conventions: inline `style={{...}}` objects (no CSS classes/modules), `var(--...)` CSS custom properties for colors, `var(--font-mono)` for labels, `borderRadius: 0` throughout.
- This codebase has no automated test runner configured for this file (no `test` script wired to component tests, no existing `*.test.tsx` for `my-school`) — verification is manual via the dev server, matching existing project convention for this file.

---

## File Structure

Single file modified across all three tasks:
- **Modify:** `app/(dashboard)/my-school/SchoolHubClient.tsx` — add `Search` icon import, one new `SearchInput` helper component, three new `useState` query variables, three new filtered derivations, and wire each into its section's header + list render + empty state.

## Before You Start

Run the dev server so you can verify each task visually:

```bash
cd "C:\Users\thoma\Goal-APP"
npm run dev
```

Log in as `student@nivarro.demo` / `demo2026` (a school-scoped student account) and navigate to `/my-school`. If that account's school doesn't have enough staff/alumni/students seeded to meaningfully test filtering, use `elena@nivarro.demo` / `demo2026` or check `app/api/admin/seed-demo-accounts/route.ts` for an account tied to a school with a fuller roster (Ridgepoint/Westside Academy per project memory).

---

### Task 1: Shared SearchInput component + Staff section search

**Files:**
- Modify: `app/(dashboard)/my-school/SchoolHubClient.tsx`

**Interfaces:**
- Produces: `SearchInput({ value: string; onChange: (v: string) => void; placeholder: string })` — a controlled text input with a leading search icon, styled to match the file's existing `Avatar`/`SelectBox` helper components. Tasks 2 and 3 reuse this component as-is.
- Produces: `staffQuery` (string state) and `visibleStaff` (filtered `StaffMember[]`) — local to this task, not consumed elsewhere.

- [ ] **Step 1: Add the `Search` icon to the lucide-react import**

Find this line near the top of the file:

```tsx
import { GraduationCap, Briefcase, BookOpen, CheckSquare, Square, Users as UsersIcon } from "lucide-react";
```

Replace it with:

```tsx
import { GraduationCap, Briefcase, BookOpen, CheckSquare, Square, Users as UsersIcon, Search } from "lucide-react";
```

- [ ] **Step 2: Add the `SearchInput` helper component**

Add this new function directly after the existing `SelectBox` component (which ends right before `export default function SchoolHubClient`):

```tsx
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--n-muted)", pointerEvents: "none" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "6px 10px 6px 30px", fontSize: 12, background: "var(--surface2)",
          border: "1px solid var(--border-md)", borderRadius: 0, color: "var(--text)",
          width: 180, fontFamily: "inherit",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add `staffQuery` state**

Find:

```tsx
  const [alumniFilter, setAlumniFilter] = useState<"all" | "mentors">("all");
  const [selectMode, setSelectMode] = useState(false);
```

Replace with:

```tsx
  const [alumniFilter, setAlumniFilter] = useState<"all" | "mentors">("all");
  const [staffQuery, setStaffQuery] = useState("");
  const [alumniQuery, setAlumniQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
```

(This adds all three query variables now so Steps in later tasks only need to wire rendering, not re-touch this block.)

- [ ] **Step 4: Add `visibleStaff` derivation**

Find:

```tsx
  const visibleAlumni = alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni;
```

Add directly above it:

```tsx
  const visibleStaff = staff.filter((s) => s.displayName.toLowerCase().includes(staffQuery.trim().toLowerCase()));
```

- [ ] **Step 5: Wire the Staff section header + empty state + list**

Find the Staff section:

```tsx
      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            School Staff
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {staff.map((s) => (
```

Replace with:

```tsx
      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
              School Staff
            </p>
            <SearchInput value={staffQuery} onChange={setStaffQuery} placeholder="Search staff…" />
          </div>
          {visibleStaff.length === 0 ? (
            <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
              <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No staff match your search.</p>
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {visibleStaff.map((s) => (
```

Then find the closing of that map/grid (still inside the Staff section):

```tsx
                {selectMode && <SelectBox checked={selected.has(s.userId)} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mentors spotlight */}
```

Replace with:

```tsx
                {selectMode && <SelectBox checked={selected.has(s.userId)} />}
              </div>
            ))}
          </div>
          )}
        </section>
      )}

      {/* Mentors spotlight */}
```

- [ ] **Step 6: Verify in the browser**

With `npm run dev` running, log in and go to `/my-school`. Confirm:
- A search box with a magnifier icon appears next to "School Staff", right-aligned.
- Typing a partial name filters the staff grid live, case-insensitively.
- Clearing the box restores the full staff list.
- Typing a query that matches nobody shows "No staff match your search." in the existing empty-state box style.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\thoma\Goal-APP"
git add app/\(dashboard\)/my-school/SchoolHubClient.tsx
git commit -m "feat: add staff search bar to My School"
```

---

### Task 2: Alumni Network section search

**Files:**
- Modify: `app/(dashboard)/my-school/SchoolHubClient.tsx`

**Interfaces:**
- Consumes: `SearchInput` (from Task 1), `alumniQuery`/`setAlumniQuery` (state added in Task 1 Step 3).
- Produces: updated `visibleAlumni` derivation (now composes the existing `alumniFilter` toggle with `alumniQuery`) — no other task depends on this.

- [ ] **Step 1: Update `visibleAlumni` to compose the toggle with search**

Find:

```tsx
  const visibleStaff = staff.filter((s) => s.displayName.toLowerCase().includes(staffQuery.trim().toLowerCase()));
  const visibleAlumni = alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni;
```

Replace with:

```tsx
  const visibleStaff = staff.filter((s) => s.displayName.toLowerCase().includes(staffQuery.trim().toLowerCase()));
  const visibleAlumni = (alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni)
    .filter((a) => a.displayName.toLowerCase().includes(alumniQuery.trim().toLowerCase()));
```

- [ ] **Step 2: Add the search input next to the All/Mentors toggle**

Find:

```tsx
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "mentors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAlumniFilter(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 0,
                  border: alumniFilter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
                  background: alumniFilter === f ? "var(--amber)" : "transparent",
                  color: alumniFilter === f ? "#000" : "var(--n-text2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "All" : "Mentors"}
              </button>
            ))}
          </div>
        </div>
```

Replace with:

```tsx
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "mentors"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAlumniFilter(f)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 0,
                    border: alumniFilter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
                    background: alumniFilter === f ? "var(--amber)" : "transparent",
                    color: alumniFilter === f ? "#000" : "var(--n-text2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {f === "all" ? "All" : "Mentors"}
                </button>
              ))}
            </div>
            <SearchInput value={alumniQuery} onChange={setAlumniQuery} placeholder="Search alumni…" />
          </div>
        </div>
```

- [ ] **Step 3: Update the empty-state message to account for search**

Find:

```tsx
        {visibleAlumni.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <GraduationCap size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              {alumniFilter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni yet."}
            </p>
          </div>
        ) : (
```

Replace with:

```tsx
        {visibleAlumni.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <GraduationCap size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              {alumniQuery.trim()
                ? "No alumni match your search."
                : alumniFilter === "mentors"
                ? "No alumni have opened mentorship yet."
                : "No alumni yet."}
            </p>
          </div>
        ) : (
```

- [ ] **Step 4: Verify in the browser**

At `/my-school`:
- A search box appears next to the existing All/Mentors buttons.
- Typing a partial alumni name filters the grid live.
- Switch to "Mentors", then type a query that matches a non-mentor alumnus — confirm they stay hidden (toggle and search compose, don't override each other).
- A query matching nobody shows "No alumni match your search." (not the toggle-specific message).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\thoma\Goal-APP"
git add app/\(dashboard\)/my-school/SchoolHubClient.tsx
git commit -m "feat: add alumni search bar to My School, composed with mentor toggle"
```

---

### Task 3: Students section search

**Files:**
- Modify: `app/(dashboard)/my-school/SchoolHubClient.tsx`

**Interfaces:**
- Consumes: `SearchInput` (from Task 1), `studentQuery`/`setStudentQuery` (state added in Task 1 Step 3).
- Produces: `visibleStudents` (filtered `StudentPeer[]`) — no other task depends on this.

- [ ] **Step 1: Add `visibleStudents` derivation**

Find (this is the `allPeople` block, right after the `visibleAlumni` line updated in Task 2):

```tsx
  const allPeople = [
```

Add directly above it:

```tsx
  const visibleStudents = students.filter((s) => s.displayName.toLowerCase().includes(studentQuery.trim().toLowerCase()));

```

- [ ] **Step 2: Wire the Students section header, empty state, and list**

Find:

```tsx
      {/* Students */}
      <section>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
          Students
        </p>
        {students.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <UsersIcon size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No other students yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {students.map((s) => (
```

Replace with:

```tsx
      {/* Students */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
            Students
          </p>
          <SearchInput value={studentQuery} onChange={setStudentQuery} placeholder="Search students…" />
        </div>
        {students.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <UsersIcon size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No other students yet.</p>
          </div>
        ) : visibleStudents.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <UsersIcon size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No students match your search.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {visibleStudents.map((s) => (
```

Then find the closing of that map/grid:

```tsx
                {selectMode && <SelectBox checked={selected.has(s.id)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating selection bar */}
```

Replace with:

```tsx
                {selectMode && <SelectBox checked={selected.has(s.id)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating selection bar */}
```

(No change needed here — the closing structure already matches since Step 2 only added one more `else if` branch before the existing grid branch. This step confirms the JSX still balances; if your editor flags a mismatched brace/paren after Step 2's edit, re-check that the new `visibleStudents.length === 0 ? (...) : (` branch was inserted, not appended, between the existing `students.length === 0 ? (...) : (` and the grid.)

- [ ] **Step 3: Verify in the browser**

At `/my-school`:
- A search box appears next to "Students".
- Typing a partial name filters the students grid live.
- A query matching nobody shows "No students match your search." (distinct from the "No other students yet." shown when the school genuinely has none).
- Enter select mode (click "Request a Partnership"), check a student, then type a search query that hides that student's card — confirm the floating "N selected" count is unchanged, and opening the modal still lists that student.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\thoma\Goal-APP"
git add app/\(dashboard\)/my-school/SchoolHubClient.tsx
git commit -m "feat: add student search bar to My School"
```

---

## Self-Review Notes

- **Spec coverage:** Staff ✅ (Task 1), Alumni Network + toggle composition ✅ (Task 2), Students + distinct empty states ✅ (Task 3), selection-mode independence ✅ (verified manually in each task, not a separate task since no code change is needed to preserve it — `selected` is never touched by the new filters), Mentor Spotlight left untouched ✅ (no task modifies that section).
- **Type consistency:** `SearchInput` props (`value: string`, `onChange: (v: string) => void`, `placeholder: string`) are identical across all three call sites. `StaffMember`, `Alumnus`, `StudentPeer` types are unchanged — filtering only narrows arrays of the same type.
- **No placeholders:** every step has literal before/after code.
