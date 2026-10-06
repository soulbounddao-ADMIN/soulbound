"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, type FormEvent } from "react";
import {
  UsernameAlreadyExistsError,
  useAuth,
} from "../../lib/auth-provider";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      await signUp(username, password);
      router.push("/gate");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof UsernameAlreadyExistsError
          ? "이미 사용 중인 아이디입니다."
          : "아이디 또는 비밀번호를 확인해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-main narrow-main">
      <section className="auth-panel" aria-labelledby="signup-title">
        <h1 id="signup-title">가입하기</h1>
        <p>
          아이디와 비밀번호를 저장해 주세요. 복구는 제공하지 않으며,
          분실하면 멤버십을 잃게 됩니다.
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signup-username">아이디</label>
            <input
              id="signup-username"
              name="username"
              type="text"
              autoComplete="username"
              pattern="[a-z0-9][a-z0-9_-]{2,23}"
              required
            />
            <small>소문자·숫자·-·_ 3~24자</small>
          </div>
          <div className="field">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
            <small>6자 이상</small>
          </div>
          <div className="button-row">
            <label htmlFor="signup-terms">
              <input
                id="signup-terms"
                name="terms"
                required
                type="checkbox"
              />{" "}
              이용약관에 동의합니다
            </label>
            <Link
              className="quiet-link"
              href="/terms"
              rel="noreferrer"
              target="_blank"
            >
              약관 보기
            </Link>
            <Link
              className="quiet-link"
              href="/privacy"
              rel="noreferrer"
              target="_blank"
            >
              개인정보 처리방침 보기
            </Link>
          </div>
          {message ? (
            <p
              className={`form-message${isError ? "" : " success-message"}`}
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
          <div className="button-row">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "가입 중" : "가입하기"}
            </button>
            <Link className="quiet-link" href="/login">이미 계정이 있습니다</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
