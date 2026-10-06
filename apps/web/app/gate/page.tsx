"use client";

import type { AdmissionApplication, Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../../components/ui";
import {
  UnauthenticatedError,
  useAuth,
} from "../../lib/auth-provider";
import { rememberApplicationId } from "../../lib/application-state";
import { readJson } from "../../lib/api-response";

interface GateState {
  readonly application: AdmissionApplication | null;
  readonly membership: Membership | null;
}

export default function GatePage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [state, setState] = useState<GateState | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadState = useCallback(async (signal?: AbortSignal) => {
    setErrorMessage("");
    setState(null);
    const init = signal ? { signal } : undefined;
    try {
      const [applicationResponse, membershipResponse] = await Promise.all([
        authedFetch("/api/admission/applications/me", init),
        authedFetch("/api/membership/me", init),
      ]);

      if (applicationResponse.status === 401 || membershipResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!applicationResponse.ok || !membershipResponse.ok) {
        throw new Error("Unable to load gate state");
      }

      const application =
        await readJson<AdmissionApplication | null>(applicationResponse);
      const membership = await readJson<Membership | null>(membershipResponse);
      if (application) {
        rememberApplicationId(application.id);
      }
      setState({ application, membership });
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("입장 상태를 불러오지 못했습니다.");
      }
    }
  }, [authedFetch, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    void loadState(controller.signal);
    return () => controller.abort();
  }, [loadState, loading, router, session]);

  const nextStep = state?.membership?.status === "active"
    ? {
        title: "입장이 완료되었습니다",
        body: "멤버 공간으로 이동할 수 있습니다.",
        href: "/member",
        label: "멤버 공간으로",
      }
    : state?.application
      ? {
          title: "입장 대기",
          body: "신청 상태와 안내를 확인해 주세요.",
          href: "/apply/status",
          label: "신청 현황 보기",
        }
      : {
          title: "입장 신청",
          body: "짧은 소개와 선택 항목을 제출합니다.",
          href: "/apply",
        label: "입장 신청",
      };
  const currentStep: number | null = state
    ? state.membership?.status === "active"
      ? 3
      : 2
    : null;

  return (
    <main className="page-main">
      <header className="page-heading">
        <h1>입장 절차</h1>
        <p>지금 필요한 다음 단계를 안내합니다.</p>
      </header>

      {errorMessage ? (
        <div className="status-action-state" role="alert">
          <EmptyState>{errorMessage}</EmptyState>
          <button
            className="button-secondary"
            type="button"
            onClick={() => void loadState()}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      <div className="gate-grid">
        <section className="gate-status" aria-live="polite">
          {!state && !errorMessage ? (
            <EmptyState>현재 상태를 확인하는 중입니다.</EmptyState>
          ) : state ? (
            <>
              <h2>{nextStep.title}</h2>
              <p>{nextStep.body}</p>
              <Link className="button" href={nextStep.href}>
                {nextStep.label}
              </Link>
            </>
          ) : null}
        </section>

        <section className="status-panel" aria-labelledby="process-title">
          <h2 id="process-title">절차</h2>
          <ol className="process-list">
            <li aria-current={currentStep === 1 ? "step" : undefined}>
              계정 만들기
            </li>
            <li aria-current={currentStep === 2 ? "step" : undefined}>
              입장 신청
            </li>
            <li aria-current={currentStep === 3 ? "step" : undefined}>
              멤버 입장
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
