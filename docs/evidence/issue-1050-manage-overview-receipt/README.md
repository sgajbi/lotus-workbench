# Manage Overview receipt evidence

This diagnostic fixture evidence supports Workbench issue #1050. It demonstrates the implemented
Manage Overview presentation against controlled Gateway-shaped responses; it is not canonical
source-runtime, deployment, or business-freshness certification.

## What the evidence proves

- Source posture, browser **Checked** receipt, and **Recheck overview** share the existing page
  header instead of creating a repeated status card.
- One deliberate recheck makes exactly one request to each of the six required BFF paths.
- The primary decision remains above the fold, desktop page height remains below the governed
  1,200px ceiling, and desktop, tablet, and compact layouts have no page-level horizontal overflow.
- Automated component tests separately prove no focus, reconnect, or remount reads; complete-only
  receipt advancement from source-specific, confirmed and exhaustive payloads; fresh complete
  same-key precedence while incomplete receipts retain admitted evidence; permission revocation that
  remains withheld until a complete restored admission; malformed-source rejection; stale-recheck
  and delayed-context fencing without a false refresh failure after server admission; and truthful
  first-failure and recovery copy.

The permission-lifecycle regression uses one QueryClient for complete-cache denial, incomplete-cache
denial, and server-withheld data followed by an incomplete non-withheld remount. Repeated ordinary
and incomplete recovery failures must keep actual facts and **Checked** hidden, preserve the old
timestamp, and keep recovery focus usable. Only complete restoration shows the receipt again.
All three origins also remain withheld after unmounting beyond the former five-minute inactive
Query expiry. The fake-clock negative control exposed facts in all three cases before the scoped
Query lifetime correction; principal clearing still removes the retained owner.
Query tests separately fence late complete/denied results after cancellation and replacement; the
component suite exercises the real provider's principal-boundary cancellation and cache clearing.
The registered browser recovery scenario exercises controlled 403, repeated 503, incomplete 200,
and complete restoration through the shipped BFF path. These are fixture boundary tests, not IAM
grant provisioning or canonical runtime acceptance. The existing screenshots above remain the
original layout evidence, not captures of these later failure sequences.

The actual SSR/hydration regression advances the clock across a minute boundary between server
rendering and browser hydration. It reproduces the exact-time text mismatch from main run
`34755836227` before the correction. Query now starts without a browser receipt and records one at
client admission; no `suppressHydrationWarning`, page-local clock authority, or retry exception is used.

## Artifacts

| Artifact | Viewport | Purpose |
| --- | --- | --- |
| `manage-overview/manage-overview-1440.png` | 1440 × 1000 | Dense desktop decision composition |
| `manage-overview/manage-overview-1024.png` | 1024 × 900 | Compact workstation composition |
| `manage-overview/manage-overview-768.png` | 768 × 900 | Tablet composition |
| `manage-overview/manage-overview-519.png` | 519 × 844 | Narrow responsive composition |

## Reproduction

From the `lotus-workbench` repository root:

```powershell
$env:MANAGE_OVERVIEW_EVIDENCE_DIR = "docs/evidence/issue-1050-manage-overview-receipt"
npm run test:e2e:manage:overview
```

```bash
MANAGE_OVERVIEW_EVIDENCE_DIR="docs/evidence/issue-1050-manage-overview-receipt" \
  npm run test:e2e:manage:overview
```

The governed runner owns isolated Workbench and fixture-Gateway ports and does not reuse or stop the
shared canonical runtime.
