# Product Note

Nightly invoice sync should send pending invoices to an external accounting
system and mark successful invoices as synced.

Known facts:

- The sync runs once per night.
- Only pending invoices are in scope.
- The external accounting system may fail transiently.
- The current note does not define retry count, freshness target, owner, or
  duplicate-send behavior.

Open questions:

- When can an invoice be marked as synced?
- What should happen when the external call succeeds but local status update
  fails?
- What should happen when the external call fails after partial work?
- How should duplicate nightly runs behave?
- What validation is required before merge?
