export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

export interface UpdateWatchOptions {
  readonly onUpdateReady: (worker: ServiceWorker) => void;
}

/**
 * Calls onUpdateReady when a new worker is installed and waiting while an older worker
 * still controls the page. The very first install (no controller) never prompts.
 */
export function watchForWaitingWorker(
  registration: ServiceWorkerRegistration,
  container: Pick<ServiceWorkerContainer, "controller">,
  { onUpdateReady }: UpdateWatchOptions,
): () => void {
  let disposed = false;

  function notifyIfWaiting() {
    if (!disposed && registration.waiting && container.controller) {
      onUpdateReady(registration.waiting);
    }
  }

  function trackInstalling() {
    const installing = registration.installing;
    if (!installing) {
      return;
    }
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") {
        notifyIfWaiting();
      }
    });
  }

  notifyIfWaiting();
  trackInstalling();
  registration.addEventListener("updatefound", trackInstalling);

  return () => {
    disposed = true;
    registration.removeEventListener("updatefound", trackInstalling);
  };
}

/**
 * Reloads exactly once, and only after the user accepted an update. Guards against
 * reload loops and against the controllerchange fired by clients.claim() on first install.
 */
export function createReloadGuard(reload: () => void) {
  let accepted = false;
  let reloaded = false;
  return {
    accept() {
      accepted = true;
    },
    onControllerChange() {
      if (!accepted || reloaded) {
        return false;
      }
      reloaded = true;
      reload();
      return true;
    },
  };
}
