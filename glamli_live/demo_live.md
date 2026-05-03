# GLAMLI/live — demo script

A 60–90 second click-through that demonstrates the prototype's thesis: the model
is always running, and every change the user makes produces a visible delta on
the live model. Each step lists what to click, what the audience should *see*,
and *why* — what the demo is supposed to prove about the design.

Begin at `#empty`. Press **D** beforehand only if you want to hide the state
switcher during a user-test session; keep it visible for design review.

---

### 1. Open at `#empty`  (~5s)
**Click:** nothing — let the audience read the invite.
**See:** a calm, single-card workspace. No stages, no setup, no questions.
**Why:** the prototype refuses the configuration-first metaphor before you've
even uploaded a file. There is no "step zero."

### 2. Click *use sample · customer_churn.csv*  (~6s)
**See:** the parse bar fills in ~800 ms; the workspace transitions into the
two-pane shell; the live pill flips to **retraining** (amber); test cells
fade in one after another over ~1.5 s; the sparkline draws to a flat 3/5;
the pill returns to **ready** (sage).
**Why:** the model exists from the moment data exists. The user has already
seen value before they have answered a single question.

### 3. Land on `#baseline`  (~6s)
**See:** hero pass-rate **3/5** with the italic accent digit; example 4
glowing rust ("predicted *will stay*, expected *will churn*"); inbox to the
left holds four suggestions, with the priority *test 4 failing → feature
hint* card on top, marked by an amber left rule.
**Why:** the failing test is the prototype's call-to-action. The system has
already proposed the most useful next move.

### 4. Click *try it* on the priority card  (~4s)
**See:** the card slides up and out (300 ms); remaining cards close the gap;
the pill flips to **retraining** (amber pulse); ~2.5 s pause.
**Why:** suggestions don't open dialogs. They commit, and the system shows
its work.

### 5. The signature animation lands  (~2s)
**See:** the pill flips back to **ready**; the example-4 cell flips
rust → sage; the predicted string updates to *will churn*; the hero number
flips **3 → 4**; the sparkline draws a new ascending segment with its
endpoint dot; the timeline gains a new top entry "treated `senior_citizen ×
no_add_ons` as a combined feature · **+1 test ↑**".
**Why:** this is the prototype's thesis in motion. The user just learned
what a column transformation does, by seeing what one does.

### 6. State is now `#active` — type into the composer  (~6s)
**Type:** *can I add more data?*  Press Enter.
**See:** the input clears; an amber **about your data** card slides in at
the top of the inbox with a one-time amber-tint flash; existing cards slide
down. The user's question is briefly visible above the card as a faint
italic line.
**Why:** the canonical counter to the *add-more-data* trap CoAutoML
identified. The system steers the user toward column work without scolding
them.

### 7. Read the amber card  (~10s)
**See:** the card explicitly reframes the question and offers an alternative
move (*split tenure*) as the primary action, with *i still want to add data*
available as a respectful secondary.
**Why:** the design treats novice intuition as legitimate but redirectable —
no jargon, no condescension, no metrics.

### 8. Click *try the split instead*  (~4s)
**See:** the card exits; pill briefly retrains; timeline gains a new entry.
The hero stays at 4/5 — not every move helps, and the system is honest
about that ("+0 tests").
**Why:** the prototype admits when an action didn't pay off. Honesty is part
of the calm.

### 9. Jump to `#locked` via the state switcher  (~6s)
*(In a live demo, you'd accept a few more suggestions to push 4/5 → 5/5 and
trigger the lock prompt naturally. For a 60-second walkthrough, jump.)*
**See:** the pulse pill is now a steady sage **locked v7**; the lock
banner appears above the hero with *use this model*; inbox flips to a
read-only history of every move that got us here.
**Why:** the model has a release moment, but the workspace never stopped
being the workspace.

### 10. Press **D**  (~2s)
**See:** the state switcher fades away.
**Why:** this control is for the reviewer, not the user. The prototype is
designed to look final without it.

---

**Total:** ~50–70 seconds depending on read time.
**Single most important moment:** step 5 (the rust → sage cell flip + 3→4
hero flip). If only one frame of this prototype could be shown, it would be
that one.
