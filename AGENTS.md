<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Retain the TanStack file-route shell and existing feature pages; every navigation target must have a matching leaf route.
- Centralise financial formulas in the client-safe financial module and use invoice-level payment allocations for receivables; unallocated legacy payments must never be silently assumed to settle invoices.
- Apply and reverse imports through permission-checked transactional database functions, using import job provenance and soft voiding; this prevents partial financial imports and preserves records.
- Use a shared real/demo source selector and source-aware query keys for all analytics, so imported records never share totals with fictional records.
- Keep role mutations in an owner-authorised database function and retain the last owner; client navigation is not a security boundary.
