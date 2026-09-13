import type { ReactNode } from "react";

import { ActionLink, ScreenStatePanel } from "@/design-system";

export default function ReviewContextRecovery({
  body,
  href,
  actionLabel,
  action,
}: {
  body: string;
  href: string;
  actionLabel: string;
  action?: ReactNode;
}) {
  return (
    <ScreenStatePanel
      kind="error"
      surface="portfolio"
      title="Review context needs attention"
      body={body}
      action={action ?? <ActionLink href={href}>{actionLabel}</ActionLink>}
    />
  );
}
