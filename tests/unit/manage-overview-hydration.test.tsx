import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { ManageWorkspace } from "../../src/features/workbench/manage-workspace";
import { buildManageWorkspaceData } from "./manage-workspace-fixtures";

it("hydrates the Overview receipt without inventing different server and browser check times", async () => {
  const data = buildManageWorkspaceData();
  const tree = (client: QueryClient) => (
    <QueryClientProvider client={client}>
      <ManageWorkspace data={data} mode="overview" reviewContext={{ portfolioId: "PF_1001" }} />
    </QueryClientProvider>
  );
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-05-13T10:00:59Z"));
  const container = document.createElement("div");
  const recoverableError = vi.fn();
  let root: Root | undefined;
  try {
    container.innerHTML = renderToString(tree(new QueryClient()));
    expect(container.textContent).not.toContain("Checked ");
    document.body.append(container);
    now.mockReturnValue(Date.parse("2026-05-13T10:02:01Z"));
    await act(async () => {
      root = hydrateRoot(container, tree(new QueryClient()), { onRecoverableError: recoverableError });
    });
    expect(recoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Checked just now");
    expect(container.textContent).toContain("1,250,000.00 USD");
  } finally {
    await act(async () => root?.unmount());
    container.remove();
    now.mockRestore();
  }
});
