"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./update-banner.module.css";
import {
  createReloadGuard,
  SKIP_WAITING_MESSAGE,
  watchForWaitingWorker,
} from "./sw-update";

export function ServiceWorkerProvider() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const guardRef = useRef<ReturnType<typeof createReloadGuard> | null>(null);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const container = navigator.serviceWorker;
    const guard = createReloadGuard(() => window.location.reload());
    guardRef.current = guard;
    let stopWatching: (() => void) | undefined;
    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;

    function handleControllerChange() {
      guard.onControllerChange();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && registration) {
        void registration.update().catch(() => undefined);
      }
    }

    container.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", handleVisibility);

    void container
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((value) => {
        if (cancelled) {
          return;
        }
        registration = value;
        stopWatching = watchForWaitingWorker(value, container, {
          onUpdateReady: setWaitingWorker,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      stopWatching?.();
      container.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (!waitingWorker) {
    return null;
  }

  function applyUpdate() {
    guardRef.current?.accept();
    waitingWorker?.postMessage(SKIP_WAITING_MESSAGE);
  }

  return (
    <div className={styles.updateBanner} role="status">
      <span>새 버전이 있습니다</span>
      <button className={styles.updateButton} type="button" onClick={applyUpdate}>
        새로고침
      </button>
    </div>
  );
}
