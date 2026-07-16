# v4.1.0 Candidate Authorization

Status: authorized for a new candidate only
Recorded: 2026-07-16
Scope: `v4.1.0-rc.1` targeting `v4.1.0`

The corrective decision in
[issue #73](https://github.com/lliangcol/llm-plugins-fusion/issues/73)
keeps `v4.0.0` immutable and requires the next release attempt to start from a
new governed candidate. This record selects `v4.1.0-rc.1` as that candidate.
It does not retroactively validate earlier merges, tags, approvals, or release
evidence.

Authorization is bound in source control to the stable and candidate tags. It
does not embed the candidate commit SHA because a commit cannot contain its own
Git object id without changing that id. The actual source commit remains
fail-closed through all of the following:

- the signed annotated RC tag points to one immutable source commit;
- current independent-review evidence identifies that merge commit and binds
  approvals to the merged pull request's final reviewed head;
- the candidate envelope, promotion intent, control bundle, artifact digests,
  and exact-tag install evidence bind the same source commit.

Candidate publication still requires the configured independent reviewer,
successful current checks, authenticated exact-tag install proof, and protected
`release` environment approval. Stable promotion additionally requires the
seven-day observation window, signer-overlap evidence, a successful recovery
drill, and current protected-publication evidence. Until those records exist,
no stable publication or `INSTALL_PROVEN` transition is authorized.
