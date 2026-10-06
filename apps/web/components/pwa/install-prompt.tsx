"use client";

import React, { useEffect, useId, useState } from "react";
import styles from "./install-prompt.module.css";
import {
  detectInAppBrowser,
  externalBrowserUrl,
  INSTALL_DISMISS_KEY,
  type InstallMode,
  isDismissalActive,
  isIos,
  type PlatformInput,
  resolveInstallMode,
} from "./install-platform";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    readonly outcome: "accepted" | "dismissed";
    readonly platform: string;
  }>;
  prompt: () => Promise<void>;
}

function isNavigatorWithStandalone(
  navigatorValue: Navigator,
): navigatorValue is Navigator & { readonly standalone?: boolean } {
  return "standalone" in navigatorValue;
}

function isStandaloneDisplay() {
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone =
    isNavigatorWithStandalone(navigator) && navigator.standalone === true;
  return mediaStandalone || navigatorStandalone;
}

function readDismissed() {
  try {
    return isDismissalActive(
      window.localStorage.getItem(INSTALL_DISMISS_KEY),
      Date.now(),
    );
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage may be unavailable (private mode); dismissal then lasts for this page only.
  }
}

function currentPlatform(): PlatformInput {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

export function InstallPrompt() {
  const helpId = useId();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<PlatformInput | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(currentPlatform());
    setStandalone(isStandaloneDisplay());
    setDismissed(readDismissed());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setStandalone(true);
      setPromptEvent(null);
      setShowHelp(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const mode: InstallMode = platform
    ? resolveInstallMode({
        ...platform,
        standalone,
        dismissed,
        hasPromptEvent: promptEvent !== null,
      })
    : "none";

  if (mode === "none" || !platform) {
    return null;
  }

  function dismiss() {
    writeDismissed();
    setDismissed(true);
    setShowHelp(false);
  }

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "dismissed") {
        dismiss();
      }
      return;
    }
    setShowHelp((value) => !value);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const openUrl =
    mode === "in-app" ? externalBrowserUrl(platform, window.location.href) : null;
  const iosDevice = isIos(platform);
  const kakao = detectInAppBrowser(platform) === "kakaotalk";

  return (
    <div className={styles.installPrompt}>
      <button
        aria-controls={mode === "native" ? undefined : helpId}
        aria-expanded={mode === "native" ? undefined : showHelp}
        className={styles.installButton}
        type="button"
        onClick={() => void install()}
      >
        설치
      </button>
      {showHelp && mode === "ios" ? (
        <div className={styles.iosHelp} id={helpId} role="status">
          <p className={styles.helpTitle}>홈 화면에 추가하기</p>
          <ol className={styles.helpSteps}>
            <li>브라우저의 공유 버튼(네모 위 화살표)을 누릅니다.</li>
            <li>목록에서 &ldquo;홈 화면에 추가&rdquo;를 선택합니다.</li>
            <li>오른쪽 위 &ldquo;추가&rdquo;를 누르면 완료됩니다.</li>
          </ol>
          <button className={styles.helpDismiss} type="button" onClick={dismiss}>
            닫기
          </button>
        </div>
      ) : null}
      {showHelp && mode === "in-app" ? (
        <div className={styles.iosHelp} id={helpId} role="status">
          <p className={styles.helpTitle}>Safari/Chrome으로 열기</p>
          <p className={styles.helpText}>
            {kakao ? "카카오톡" : "앱"} 안의 브라우저에서는 설치할 수 없습니다.{" "}
            {iosDevice ? "Safari" : "Chrome"}으로 연 뒤 설치해 주세요.
          </p>
          {!openUrl ? (
            <p className={styles.helpText}>
              오른쪽 위(또는 아래) 메뉴에서 &ldquo;
              {iosDevice ? "Safari로 열기" : "다른 브라우저로 열기"}&rdquo;를
              선택하세요.
            </p>
          ) : null}
          <div className={styles.helpActions}>
            {openUrl ? (
              <a className={styles.helpPrimary} href={openUrl}>
                {iosDevice ? "Safari로 열기" : "Chrome으로 열기"}
              </a>
            ) : null}
            <button
              className={styles.helpSecondary}
              type="button"
              onClick={() => void copyLink()}
            >
              {copied ? "복사됨" : "링크 복사"}
            </button>
            <button className={styles.helpDismiss} type="button" onClick={dismiss}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
