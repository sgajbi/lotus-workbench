import type { ReactNode, Ref } from "react";

import { cx } from "../utils/cx";

import Panel from "./panel";
import SectionHeader from "./section-header";

export default function SectionBlock({
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
  bodyClassName,
  bodyRef,
  id,
  interactiveReady,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  id?: string;
  interactiveReady?: boolean;
}) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <Panel
      id={id}
      className={cx("section-block", className)}
      aria-busy={interactiveReady === false ? true : undefined}
      data-client-interactive={
        interactiveReady === undefined ? undefined : String(interactiveReady)
      }
      inert={interactiveReady === false ? true : undefined}
    >
      {hasHeader ? (
        <SectionHeader
          title={title ?? "Section"}
          subtitle={subtitle}
          actions={actions}
          className={headerClassName}
        />
      ) : null}
      <div ref={bodyRef} className={cx("section-block-body", bodyClassName)}>
        {children}
      </div>
    </Panel>
  );
}
