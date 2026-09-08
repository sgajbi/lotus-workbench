import {
  WORKBENCH_AUTHORITY_CONTEXT_HEADER,
  WORKBENCH_AUTHORITY_CONTEXT_PATTERN,
} from "./authority-context-contract";

type AuthorityChangeListener = () => void;

let activeAuthorityContext: string | null = null;
const authorityChangeListeners = new Set<AuthorityChangeListener>();

export class StaleAuthorityResponseError extends Error {
  constructor() {
    super("The authenticated Workbench authority changed while this request was active");
    this.name = "StaleAuthorityResponseError";
  }
}

export function captureActiveAuthorityContext(): string | null {
  return typeof window === "undefined" ? null : activeAuthorityContext;
}

export function reconcileResponseAuthorityContext(
  response: Response,
  authorityAtDispatch: string | null,
): void {
  if (typeof window === "undefined") return;
  if (!response.headers || typeof response.headers.get !== "function") return;
  const responseAuthority = response.headers.get(WORKBENCH_AUTHORITY_CONTEXT_HEADER);
  if (!responseAuthority || !WORKBENCH_AUTHORITY_CONTEXT_PATTERN.test(responseAuthority)) {
    return;
  }

  if (
    activeAuthorityContext &&
    authorityAtDispatch &&
    authorityAtDispatch !== activeAuthorityContext &&
    responseAuthority !== activeAuthorityContext
  ) {
    throw new StaleAuthorityResponseError();
  }
  if (responseAuthority === activeAuthorityContext) return;

  const previousAuthority = activeAuthorityContext;
  activeAuthorityContext = responseAuthority;
  if (previousAuthority) {
    for (const listener of authorityChangeListeners) listener();
  }
}

export function subscribeToAuthorityChanges(
  listener: AuthorityChangeListener,
): () => void {
  authorityChangeListeners.add(listener);
  return () => authorityChangeListeners.delete(listener);
}

export function resetClientAuthorityContextForTests(): void {
  activeAuthorityContext = null;
  authorityChangeListeners.clear();
}
