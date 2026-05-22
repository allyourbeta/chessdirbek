You are performing a stabilization refactor on an existing vanilla-JS chess training web app.

This is NOT a rewrite.

Do NOT:

* migrate frameworks
* add TypeScript
* add React/Vue/Svelte
* redesign the UI
* change workflows
* rename large sections of the app
* reorganize the entire repository
* replace working code merely for style reasons

Your task is:

* remove hidden coupling
* eliminate duplicated business logic
* centralize lifecycle ownership
* improve maintainability
* improve regression safety
* improve consistency
* improve testability

CRITICAL:
You must COMPLETE each phase fully before proceeding.

You are NOT allowed to:

* partially complete a phase
* create scaffolding without migration
* leave duplicate old/new implementations in place
* declare completion without verification

For every phase:

1. perform the transformation
2. run required audit commands
3. report BEFORE and AFTER counts
4. run regression tests
5. stop if metrics are not satisfied

Do not continue to later phases if completion metrics fail.

When uncertain:
prefer smaller safer changes.

You must preserve working behavior at all times.

The app must remain runnable after every phase.

You must not perform broad unrelated cleanup.

No speculative architecture.

No “future-proofing.”

No unnecessary abstractions.

No dead helper layers.

Favor:

* explicitness
* incrementalism
* grep-able consistency
* regression safety

You must obey the stabilization spec exactly.
