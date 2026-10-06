import Link from "next/link";
import React from "react";

export const metadata = {
  title: "개인정보 처리방침 (초안)",
};

export default function PrivacyPage() {
  return (
    <main className="page-main narrow-main">
      <article className="auth-panel" aria-labelledby="terms-title">
        <h1>개인정보 처리방침</h1>
        <p className="prose-text">
          <strong>초안 — 법률 검토 전 (DRAFT, pending legal review)</strong>
        </p>
        <section aria-labelledby="privacy-draft">
          <h2 id="privacy-draft">초안 안내</h2>
          <p className="prose-text">이 문서는 <strong>초안 — 법률 검토 전 (DRAFT, pending legal review)</strong>입니다. 법률 검토를 거쳐 확정되기 전까지 내용이 바뀔 수 있습니다.</p>
          <p className="prose-text">아래 내용은 현재 서비스 코드와 데이터베이스 구조에서 실제로 저장·처리하는 항목을 기준으로 작성했습니다. 확정되지 않은 사항은 “TODO(법률 검토)”로 표시했습니다.</p>
        </section>
        <section aria-labelledby="privacy-items">
          <h2 id="privacy-items">1. 처리하는 정보</h2>
          <ul className="prose-text">
            <li>계정: 아이디(username), 비밀번호. 비밀번호는 인증 서비스(Supabase Auth)가 해시로 저장하며 운영진은 원문을 알 수 없습니다. 실명·전화번호·실제 이메일은 받지 않습니다(로그인용 내부 주소 <code>아이디@soulbound.internal</code>만 생성됩니다).</li>
            <li>회원 상태: 역할(신청자/멤버/검토자/관리자), 멤버십 상태, 멤버 번호. 다른 멤버에게는 멤버 번호(soulbound-member-N)만 보입니다.</li>
            <li>입장 신청: 신청서 내용(소개 문구 등), 신청 상태와 심사 결정 코드.</li>
            <li>Persona Clip: 입장 심사용 짧은 영상·음성 원본과 그 해시값.</li>
            <li>게시판: 작성한 게시글·댓글 본문, 작성 시각, 위·변조 확인용 해시값.</li>
            <li>입장 투표: 투표 참여 여부와 시각(분 단위). 찬반 선택은 참여자와 분리된 익명 표로 저장됩니다.</li>
            <li>신고: 신고 대상(게시글/댓글/멤버 번호), 사유 코드, 선택 입력한 설명(최대 500자), 처리 상태.</li>
            <li>차단: 내가 차단한 멤버 목록. 차단당한 사람은 누가 자신을 차단했는지 볼 수 없습니다.</li>
            <li>운영 기록(감사 로그): 신청·심사·신고 처리·계정 삭제 같은 행위의 내부 식별자, 행위 종류, 사유 코드, 시각. 자유 서술 텍스트는 기록하지 않으며 위·변조 확인을 위해 해시 체인으로 연결됩니다.</li>
            <li>기기 저장: 로그인 세션 토큰을 브라우저 저장소 또는 iPhone 보안 저장소(Keychain)에 보관합니다.</li>
            <li>접속 기록: 호스팅·인프라 제공자가 요청 로그(IP 주소 등)를 남길 수 있습니다. TODO(법률 검토): 제공자별 로그 항목과 보관 기간 확인.</li>
          </ul>
        </section>
        <section aria-labelledby="privacy-purpose">
          <h2 id="privacy-purpose">2. 이용 목적</h2>
          <p className="prose-text">계정 인증, 입장 심사와 멤버 투표 운영, 멤버 전용 게시판 제공, 신고 처리와 차단 등 이용자 보호, 운영 기록의 무결성 확인에만 이용합니다. 광고나 마케팅 목적으로 이용하지 않습니다.</p>
        </section>
        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">3. 보관 기간과 파기</h2>
          <ul className="prose-text">
            <li>Persona Clip 원본: 심사가 끝나면(승인·거절·철회·만료) 자동 삭제 대상이 되고, 제출하지 않은 초안은 24시간 뒤 삭제 대상이 됩니다. 원본은 영구 보관하지 않으며 해시값만 남을 수 있습니다.</li>
            <li>입장 신청서 내용: 심사 종결 후 파쇄하는 것을 원칙으로 하며, 계정 삭제 시 즉시 지웁니다. TODO(법률 검토): 심사 종결 시점 파쇄 범위 확정.</li>
            <li>게시글·댓글·차단 목록·멤버십: 직접 삭제하거나 계정을 삭제할 때까지 보관합니다.</li>
            <li>신고: 처리 기록 보관을 위해 남습니다. 신고자나 대상자가 계정을 삭제하면 해당 계정과의 연결이 끊깁니다. TODO(법률 검토): 신고 기록 보관 기간.</li>
            <li>감사 로그: 운영 무결성(해시 체인) 확인을 위해 보관합니다. TODO(법률 검토): 보관 기간과 법적 근거.</li>
          </ul>
        </section>
        <section aria-labelledby="privacy-deletion">
          <h2 id="privacy-deletion">4. 계정 삭제</h2>
          <ul className="prose-text">
            <li>앱의 설정 → 계정 삭제(또는 웹 API)에서 확인 후 즉시 삭제할 수 있습니다. 되돌릴 수 없습니다.</li>
            <li>즉시 삭제: 계정과 비밀번호, 프로필(아이디·멤버 번호), 멤버십, 내 입장 신청서, Persona Clip 원본과 기록, 게시글·댓글, 차단 목록, 투표 영상 열람 기록.</li>
            <li>연결을 끊고 남김: 감사 로그(더 이상 누구와도 연결되지 않는 내부 식별자와 코드), 다른 사람의 신청에 대해 내가 심사한 기록(행위자 정보 제거), 투표 참여 집계(익명 표의 정합성 유지), 내가 접수한 신고(신고자 정보 제거).</li>
          </ul>
        </section>
        <section aria-labelledby="privacy-third">
          <h2 id="privacy-third">5. 처리 위탁 및 제3자</h2>
          <ul className="prose-text">
            <li>Supabase: 데이터베이스, 인증, 파일 저장(Persona Clip). TODO(법률 검토): 데이터 저장 리전과 국외 이전 고지.</li>
            <li>Vercel: 웹 서비스와 API 호스팅. TODO(법률 검토): 국외 이전 고지.</li>
            <li>그 밖에 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 블록체인 등 외부 원장에 개인정보를 기록하지 않습니다.</li>
          </ul>
        </section>
        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">6. 이용자의 권리</h2>
          <p className="prose-text">언제든지 계정 삭제로 정보 삭제를 요청할 수 있고, 차단·차단 해제와 내 게시글·댓글 삭제는 앱에서 직접 할 수 있습니다. 만 14세 미만은 가입할 수 없습니다.</p>
          <p className="prose-text">TODO(법률 검토): 열람·정정·처리정지 요구 절차, 개인정보 보호책임자와 연락처, 권익침해 구제 방법, 시행일.</p>
        </section>
        <section aria-labelledby="privacy-en">
          <h2 id="privacy-en">English summary (DRAFT, pending legal review)</h2>
          <p className="prose-text">SoulBound stores a username and password hash (no real name, phone or email), membership status and member number, admission dossier content, Persona Clip media (deleted after review ends; drafts after 24 hours), board posts and comments, anonymous vote turnout, reports and blocks, and a codes-only, hash-chained audit log. Infrastructure: Supabase (database, auth, storage) and Vercel (hosting). Accounts can be deleted in the app (Settings → Delete account); owned data is deleted immediately and retained operational records are de-identified. Items marked TODO await legal review.</p>
        </section>
        <p className="prose-text">
          관련 문서: <Link href="/terms">이용약관</Link>
        </p>
      </article>
    </main>
  );
}
