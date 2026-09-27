"use client";

import { DefinitionList, Text, WorkbenchRailCard } from "@/design-system";
import { buildManageEvidenceRailModel } from "@/features/workbench/manage-evidence-rail-view-model";
import type { ManageWorkspaceData } from "@/features/workbench/manage-workspace-data";
import { useManageProofPackState } from "@/features/workbench/manage-proof-pack-state";

import styles from "./manage-evidence-rail.module.css";

export default function ManageEvidenceRail({
  data,
}: {
  data: ManageWorkspaceData;
}) {
  const sharedProofPack = useManageProofPackState();
  const model = buildManageEvidenceRailModel(
    sharedProofPack?.proofPack
      ? { ...data, proofPack: sharedProofPack.proofPack, proofPackError: null }
      : data,
  );

  return (
    <div className={styles.rail}>
      <WorkbenchRailCard>
        <div className={styles.header}>
          <Text variant="dataLabel">Review evidence</Text>
          <strong className={styles.headline}>{model.headline}</strong>
        </div>
        <DefinitionList
          ariaLabel="Manage source evidence"
          className={styles.definitionList}
          items={model.items}
        />
      </WorkbenchRailCard>
    </div>
  );
}
