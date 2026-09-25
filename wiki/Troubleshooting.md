# Troubleshooting

## Common checks

- if the UI looks right on localhost but breaks on canonical hosts, fix the runtime and host mapping first
- if a route appears active in old docs, verify whether it is now a compatibility redirect
- if `Proposal` or `Advisory` appear unavailable, check shell capabilities before treating that as
  a regression
- if a screen looks populated but canonical validation fails, treat it as diagnostic evidence only
- if product data looks wrong, inspect gateway responses before adjusting frontend presentation
- if Workbench BFF calls fail with `ECONNREFUSED` to `127.0.0.1:8111` or `localhost:8111`, ensure
  local Workbench sets `BFF_BASE_URL` to the
  [canonical Gateway](http://gateway.dev.lotus); canonical proof must use the governed Gateway
  hostname, not a stale local port override
- if performance evidence is partial, review Gateway and performance logs for `correlation_id`,
  `request_id`, `trace_id`, lineage lookup status, and `PERFORMANCE_EVIDENCE_PARTIAL` before
  classifying the evidence as a runtime defect
- if Summary, Risk Review, or Advisor Brief show `Access restricted`, verify caller-context
  headers and Gateway `analytics_read_denied` audit logs; do not paste or expose raw entitlement
  response bodies in screenshots, metric labels, support tickets, or demo evidence

## Useful commands

```bash
make check
make test-e2e
npm run live:stack:up:validate
```

## References

- [docs/operations/canonical-front-office-local-runtime.md](https://github.com/sgajbi/lotus-workbench/blob/main/docs/operations/canonical-front-office-local-runtime.md)
- [docs/architecture/CODEBASE-REVIEW-LEDGER.md](https://github.com/sgajbi/lotus-workbench/blob/main/docs/architecture/CODEBASE-REVIEW-LEDGER.md)
