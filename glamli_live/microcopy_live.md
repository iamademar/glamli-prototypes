# GLAMLI/live — microcopy variants

Voice rules from §1.4 apply throughout. Lowercase informal is acceptable inside
chat-style assistant lines; never in tags, labels, or button copy. Italics in
prose (where rendered) carry emphasis; column names and values appear inline as
JetBrains Mono tags. Banned vocabulary (feature, encoder, F1, AUC, etc.) is
absent from default surfaces.

---

### `feature hint` — typical opener
> I noticed `<col_a>` and `<col_b>` rarely show up together — want me to treat
> that combination as a thing of its own?

### `feature hint` (split / bucket variant)
> Most subscription churn happens in the first year. Want to split `tenure`
> into "first 12 months" vs. "after"?

### `domain hint` — typical opener
> Quick question — for `<col>`, is "<value_a>" categorically different from
> "<value_b>" and "<value_c>", or is it a scale (shorter → longer)?

### `about your data` — counter to the add-more-data trap (canonical, verbatim)
> You asked if more data would help. Honestly — probably not much. Your model
> is already learning well from 7,043 rows; the bottleneck is which columns we
> feed it. I'd rather try splitting `tenure` into "first 12 months" vs.
> "after" — that's how churn behaves in most subscription products.

### `examples` — typical opener
> I'm running on five example customers. Two more like the ones you described
> and I'll have enough to spot edge cases.

### `test N failing` — opener (always paired with a fix proposal)
> Test 4 is failing. I notice `senior_citizen` + `no_add_ons` together is
> uncommon in your data — want me to treat that combination as a feature on
> its own?

### "Want to lock this in?" — ceiling prompt
> I think we've reached a good place — 5 of 5 examples passing, stable across
> the last 3 versions. Want to lock this in?

### Locked-state line (top-bar pill / banner)
> locked v7 · 5 of 5 examples passing, stable across 3 versions

### Empty-state invite
> Drop a CSV — I'll have a working model on it within seconds.
> No setup. No questions about goals or metrics.
