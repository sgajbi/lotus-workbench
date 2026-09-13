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
  same-key precedence while incomplete receipts retain admitted evidence; permission revocation;
  restored facts; malformed-source rejection; stale-recheck and delayed-context fencing without a
  false refresh failure after server admission; and truthful first-failure and recovery copy.

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
