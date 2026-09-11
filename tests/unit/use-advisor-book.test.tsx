import { act, renderHook, waitFor } from "@testing-library/react";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAdvisorBook } from "@/features/advisor-book/use-advisor-book";
import { WorkbenchApiError } from "@/features/workbench/api-client";
import { createQueryClientWrapper } from "../helpers/query-client-test-harness";

const getAdvisorBookMock = vi.fn();

vi.mock("@/features/advisor-book/api", () => ({
  getAdvisorBook: (...args: unknown[]) => getAdvisorBookMock(...args),
}));

describe("useAdvisorBook", () => {
  beforeEach(() => {
    getAdvisorBookMock.mockReset();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  });

  it("uses a distinct query identity when the source view changes", async () => {
    getAdvisorBookMock
      .mockResolvedValueOnce({ correlation_id: "first" })
      .mockResolvedValueOnce({ correlation_id: "second" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ clientId }) => useAdvisorBook({ asOfDate: "2026-04-10", clientId }),
      {
        initialProps: { clientId: "CIF_001" },
        wrapper: createQueryClientWrapper(queryClient),
      },
    );

    await waitFor(() => expect(result.current.response).toEqual({ correlation_id: "first" }));
    rerender({ clientId: "CIF_002" });
    await waitFor(() => expect(result.current.response).toEqual({ correlation_id: "second" }));
    expect(getAdvisorBookMock).toHaveBeenNthCalledWith(
      2,
      { asOfDate: "2026-04-10", clientId: "CIF_002" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not publish a late response from the previous source view", async () => {
    let resolveFirst: ((value: { correlation_id: string }) => void) | undefined;
    getAdvisorBookMock
      .mockImplementationOnce(
        () =>
          new Promise<{ correlation_id: string }>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ correlation_id: "current-view" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ clientId }) => useAdvisorBook({ asOfDate: "2026-04-10", clientId }),
      {
        initialProps: { clientId: "CIF_OLD" },
        wrapper: createQueryClientWrapper(queryClient),
      },
    );

    await waitFor(() => expect(getAdvisorBookMock).toHaveBeenCalledTimes(1));
    rerender({ clientId: "CIF_CURRENT" });
    await waitFor(() =>
      expect(result.current.response).toEqual({ correlation_id: "current-view" }),
    );

    await act(async () => {
      resolveFirst?.({ correlation_id: "late-old-view" });
      await Promise.resolve();
    });

    expect(result.current.response).toEqual({ correlation_id: "current-view" });
  });

  it("does not re-read a successful view on remount, focus, or reconnect", async () => {
    getAdvisorBookMock.mockResolvedValue({ correlation_id: "book" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createQueryClientWrapper(queryClient);
    const first = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );

    await waitFor(() => expect(first.result.current.response).toEqual({ correlation_id: "book" }));
    const checkedAt = first.result.current.checkedAt;
    first.unmount();
    const second = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );
    await waitFor(() => expect(second.result.current.response).toEqual({ correlation_id: "book" }));

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.checkedAt).toBe(checkedAt);
  });

  it("does not retry a failed register on remount before an explicit recovery", async () => {
    getAdvisorBookMock
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 502))
      .mockResolvedValueOnce({ correlation_id: "recovered" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createQueryClientWrapper(queryClient);
    const first = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );

    await waitFor(() => expect(first.result.current.error).toBeInstanceOf(WorkbenchApiError));
    first.unmount();
    const second = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await second.result.current.reload();
    });
    await waitFor(() =>
      expect(second.result.current.response).toEqual({ correlation_id: "recovered" }),
    );
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);
  });

  it("advances the receipt after one explicit same-view recheck", async () => {
    const response = { correlation_id: "book" };
    getAdvisorBookMock.mockResolvedValue(response);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.response).toBe(response));
    const firstReceipt = result.current.checkedAt;
    await new Promise((resolve) => window.setTimeout(resolve, 2));
    await act(async () => {
      await result.current.reload();
    });

    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.checkedAt).toBeGreaterThan(firstReceipt ?? 0));
    expect(result.current.response).toBe(response);
    expect(result.current.recheckError).toBeNull();
  });

  it("keeps an admitted register and its receipt when a recheck fails", async () => {
    const response = { correlation_id: "book" };
    getAdvisorBookMock
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error("unavailable"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.response).toBe(response));
    const checkedAt = result.current.checkedAt;
    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.recheckError).toBeInstanceOf(Error));
    expect(result.current.response).toBe(response);
    expect(result.current.checkedAt).toBe(checkedAt);
    expect(result.current.error).toBeNull();
    expect(result.current.recheckError).toBeInstanceOf(Error);
  });

  it("does not restore admitted rows or advance their receipt after a protected recheck is cancelled", async () => {
    const response = { correlation_id: "book" };
    getAdvisorBookMock
      .mockResolvedValueOnce(response)
      .mockImplementationOnce(() => new Promise(() => undefined));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.response).toBe(response));
    const checkedAt = result.current.checkedAt;
    let reloadPromise: Promise<void> | undefined;
    act(() => {
      reloadPromise = result.current.reload();
    });
    await waitFor(() => expect(getAdvisorBookMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      void queryClient.cancelQueries();
      queryClient.clear();
      await reloadPromise;
    });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(result.current.checkedAt).toBe(checkedAt);
  });

  it("withholds cached rows after a permission denial", async () => {
    getAdvisorBookMock
      .mockResolvedValueOnce({ correlation_id: "book" })
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 403));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.response).toEqual({ correlation_id: "book" }));
    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.response).toBeNull());
    expect(result.current.checkedAt).toBeNull();
    expect(result.current.error).toBeInstanceOf(WorkbenchApiError);
    expect(result.current.recheckError).toBeNull();
  });

  it("keeps permission-denied rows withheld across remount until a later recovery succeeds", async () => {
    const response = { correlation_id: "book" };
    getAdvisorBookMock
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 403))
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 502))
      .mockResolvedValueOnce(response);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createQueryClientWrapper(queryClient);
    const first = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );

    await waitFor(() => expect(first.result.current.response).toBe(response));
    await act(async () => {
      await first.result.current.reload();
    });
    await waitFor(() => expect(first.result.current.response).toBeNull());
    first.unmount();

    const second = renderHook(
      () => useAdvisorBook({ asOfDate: "2026-04-10" }),
      { wrapper },
    );
    expect(second.result.current.response).toBeNull();
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await second.result.current.reload();
    });
    await waitFor(() => expect(second.result.current.error).toBeInstanceOf(WorkbenchApiError));
    expect(second.result.current.response).toBeNull();
    expect(second.result.current.checkedAt).toBeNull();

    await act(async () => {
      await second.result.current.reload();
    });
    await waitFor(() => expect(second.result.current.response).toBe(response));
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(4);
  });

  it("recovers one out-of-range source page before publishing ready state", async () => {
    getAdvisorBookMock
      .mockResolvedValueOnce({
        items: [],
        page: { total_count: 2, offset: 100, limit: 100 },
      })
      .mockResolvedValueOnce({
        items: [{ portfolio_id: "PB_SG_GLOBAL_BAL_001" }],
        page: { total_count: 2, offset: 0, limit: 100 },
      });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(
      () =>
        useAdvisorBook(
          { asOfDate: "2026-04-22", offset: 100, limit: 100 },
          { recoverOutOfRange: true },
        ),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAdvisorBookMock).toHaveBeenNthCalledWith(
      2,
      { asOfDate: "2026-04-22", offset: 0, limit: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.response).toEqual({
      items: [{ portfolio_id: "PB_SG_GLOBAL_BAL_001" }],
      page: { total_count: 2, offset: 0, limit: 100 },
    });
    expect(result.current.error).toBeNull();
  });
});
