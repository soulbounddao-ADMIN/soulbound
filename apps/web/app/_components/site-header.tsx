"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";
import { InstallPrompt } from "../../components/pwa/install-prompt";
import { useAuth } from "../../lib/auth-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const isMemberShell = pathname === "/member" || pathname.startsWith("/member/");

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      router.push("/");
    } catch {
      setSignOutError("로그아웃하지 못했습니다.");
    }
  }

  if (isMemberShell) {
    return null;
  }

  return (
    <header className="site-header">
      <Link className="brand-link" href="/" aria-label="SoulBound 홈">
        <span className="brand-seal" aria-hidden="true">S</span>
        <span>SoulBound</span>
      </Link>
      <nav className="site-nav" aria-label="주요 탐색">
        {!loading && session ? (
          <button
            className="text-button"
            type="button"
            onClick={() => void handleSignOut()}
          >
            로그아웃
          </button>
        ) : !loading ? (
          <>
            <Link href="/login">로그인</Link>
            <Link className="nav-action" href="/signup">가입하기</Link>
          </>
        ) : (
          null
        )}
        <InstallPrompt />
      </nav>
      {signOutError ? (
        <p className="header-error" role="alert">{signOutError}</p>
      ) : null}
    </header>
  );
}
