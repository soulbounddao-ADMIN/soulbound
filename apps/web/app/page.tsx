"use client";

import Link from "next/link";
import React from "react";
import { useAuth } from "../lib/auth-provider";

export default function LandingPage() {
  const { session, loading } = useAuth();

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <h1>SoulBound</h1>
          <p className="hero-lede">
            신뢰가 확인된 사람만 들어오는 비공개 멤버 공간.
            가입하고, 입장을 신청하고, 멤버들과 게시판에서 이야기합니다.
          </p>
          <div className="hero-actions">
            {!loading && session ? (
              <Link className="button" href="/gate">입장 상태 보기</Link>
            ) : (
              <>
                <Link className="button" href="/signup">가입하기</Link>
                <Link className="button-secondary" href="/login">로그인</Link>
              </>
            )}
          </div>
        </div>
        <ol className="landing-steps" aria-label="입장 순서">
          <li>
            아이디와 비밀번호로 계정을 만듭니다.
          </li>
          <li>
            짧은 입장 신청을 보냅니다.
          </li>
          <li>
            승인 후 멤버 명부, 입장 투표, 게시판을 사용합니다.
          </li>
        </ol>
      </section>
    </main>
  );
}
