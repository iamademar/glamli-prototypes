# GLAMLI/live — microcopy variants (regression — HVAC service tickets)

Voice rules from §1.4 apply throughout. Lowercase informal is acceptable
inside chat-style assistant lines; never in tags, labels, or button copy.
Italics in prose carry emphasis; column names and values appear inline as
JetBrains Mono tags. Banned vocabulary (regression, regressor, target
variable, MAE, RMSE, R², residual, error term, plus the original §1.4 list)
is absent from default surfaces.

---

### `feature hint` — priority card, triggers signature animation
> **Test 4 is way off.** I notice `urgency=same-day` + `service_type=install`
> together is uncommon in your data — want me to treat that combination as
> its own pattern?
>
> primary: **try it** · ghost: **skip** · expected impact: *+1 ticket within band*

### `feature hint` — second card, visible in `#active`
> **Test 5 is way off.** Older equipment usually doesn't get more expensive
> in a straight line — there's a step somewhere around 15–20 years where
> parts get hard to find. Want me to split `equipment_age` at 15 years and
> let those behave differently?
>
> primary: **split it** · ghost: **skip** · expected impact: *+1 ticket within band*

### `domain hint`
> Quick question — for `urgency`, is *same-day* just *faster*, or does it
> actually cost more in a way that scales with the job? If it's the latter,
> I should treat it as ordered, not as a category.
>
> primary: **it costs more** · secondary: **just faster** · ghost: **skip**

### `about your data` — counter to the add-more-data trap (canonical, verbatim)
> You asked if more data would help. Honestly — probably not much. Your model
> is already learning from 8,247 tickets; the bottleneck is which columns we
> feed it. I'd rather try splitting `equipment_age` at a threshold — older
> equipment usually doesn't degrade in a straight line, and your prices
> probably reflect that.
>
> primary: **try splitting it** · ghost: **maybe later**

### `examples`
> Got a few more tickets where the price came in much higher than the rest?
> I'm under-predicting on the big jobs and a couple more would tell me why.

### `test 4 off` — opener (paired with the priority feature hint)
> Test 4 — predicted **$3,100**, expected **$8,400** (63% under). I have a
> hypothesis.

### "Want to lock this in?" — ceiling prompt
> I think we've reached a good place — 5 of 5 example tickets within ±20%,
> stable across the last 3 versions. Want to lock this in?
>
> primary: **lock model v7** · ghost: **keep tinkering**

### Locked-state line (top-bar pill / banner)
> locked v7 · 5 of 5 example tickets within ±20%, stable across 3 versions

### Locked-state hero caption
> 5 of 5 within ±20% · last retrained 4 minutes ago

### Empty-state invite
> drop a ticket history CSV — I'll have a working price model on it within
> seconds. No setup. No questions about goals or metrics.
>
> ghost link: **use sample · service_tickets.csv**
