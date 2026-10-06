"use client";

import { useEffect, useRef } from "react";
import {
  usePersonaClipRecorder,
  type PersonaClipResult,
} from "./use-persona-clip-recorder";
import type { AuthedFetch } from "../../lib/auth-provider";
import styles from "./persona-clip-recorder.module.css";

export type PersonaClipRecorderProps = {
  onComplete: (result: PersonaClipResult) => void;
  onSkip: () => void;
  authedFetch?: AuthedFetch;
};

export function PersonaClipRecorder({
  onComplete,
  onSkip,
  authedFetch,
}: PersonaClipRecorderProps) {
  const {
    status,
    stream,
    errorMessage,
    start,
    stop,
    skip,
  } = usePersonaClipRecorder({
    onComplete,
    onSkip,
    ...(authedFetch ? { authedFetch } : {}),
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <section
      aria-labelledby="persona-clip-title"
      className={styles.recorder}
    >
      <div>
        <h2 id="persona-clip-title" className={styles.heading}>
          Persona Clip
        </h2>
        <p className={styles.hint}>
          선택 사항
        </p>
      </div>

      {status === "recording" ? (
        <div className={styles.stack}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Persona Clip 실시간 카메라 화면"
            className={styles.video}
          />
          <button
            type="button"
            onClick={stop}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            녹화 중지
          </button>
        </div>
      ) : null}

      {status === "idle" ? (
        <div className={styles.buttonRow}>
          <button
            type="button"
            onClick={() => void start()}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            녹화하기
          </button>
          <button type="button" onClick={skip} className={styles.button}>
            건너뛰기
          </button>
        </div>
      ) : null}

      {status === "requesting" ? (
        <div className={styles.stack}>
          <p
            role="status"
            className={`${styles.statusLine} ${styles.mutedText}`}
          >
            카메라 권한을 확인하는 중입니다.
          </p>
          <div>
            <button type="button" onClick={skip} className={styles.button}>
              건너뛰기
            </button>
          </div>
        </div>
      ) : null}

      {status === "uploading" ? (
        <div aria-busy="true" role="status" className={styles.compactStack}>
          <p className={styles.statusLine}>Persona Clip을 준비하는 중입니다.</p>
          <progress aria-label="Persona Clip 업로드 중" />
        </div>
      ) : null}

      {status === "done" ? (
        <p
          role="status"
          className={`${styles.statusLine} ${styles.successText}`}
        >
          Persona Clip이 준비되었습니다.
        </p>
      ) : null}

      {status === "unavailable" ? (
        <div className={styles.stack}>
          <p role="status" className={styles.statusLine}>
            녹화를 사용할 수 없습니다. Persona Clip 없이 계속 진행할 수 있습니다.
          </p>
          <div>
            <button
              type="button"
              onClick={skip}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              계속하기
            </button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className={styles.stack}>
          <p
            role="alert"
            className={`${styles.statusLine} ${styles.dangerText}`}
          >
            {errorMessage}
          </p>
          <div className={styles.buttonRow}>
            <button
              type="button"
              onClick={() => void start()}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              다시 시도
            </button>
            <button type="button" onClick={skip} className={styles.button}>
              건너뛰기
            </button>
          </div>
        </div>
      ) : null}

      {status === "skipped" ? (
        <p
          role="status"
          className={`${styles.statusLine} ${styles.mutedText}`}
        >
          Persona Clip 없이 계속합니다.
        </p>
      ) : null}
    </section>
  );
}
