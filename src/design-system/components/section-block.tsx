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
}) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <Panel id={id} className={cx("section-block", className)}>
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
