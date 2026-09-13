import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AllocationError from "../../src/app/allocation/error";
import AllocationLoading from "../../src/app/allocation/loading";
import CashflowError from "../../src/app/cashflow/error";
import CashflowLoading from "../../src/app/cashflow/loading";
import IncomeError from "../../src/app/income/error";
import IncomeLoading from "../../src/app/income/loading";
import PositionsError from "../../src/app/positions/error";
import PositionsLoading from "../../src/app/positions/loading";
import TransactionsError from "../../src/app/transactions/error";
import TransactionsLoading from "../../src/app/transactions/loading";

const routeBoundaries = [
  ["Allocation", AllocationLoading, AllocationError],
  ["Projected cash flow", CashflowLoading, CashflowError],
  ["Income and activity", IncomeLoading, IncomeError],
  ["Positions", PositionsLoading, PositionsError],
  ["Transactions", TransactionsLoading, TransactionsError],
] as const;

describe("portfolio record route boundaries", () => {
  it.each(routeBoundaries)("renders the %s loading boundary", (title, Loading) => {
    render(<Loading />);

    expect(screen.getByText(`Preparing ${title}`)).toBeInTheDocument();
  });

  it.each(routeBoundaries)("renders and retries the %s error boundary", (title, _Loading, Error) => {
    const reset = vi.fn();
    render(<Error reset={reset} />);

    expect(screen.getByText(`We could not open ${title}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry portfolio records" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
