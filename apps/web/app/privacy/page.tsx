import Link from "next/link";
import React from "react";
import { privacyContactEmail } from "./contact";

export const metadata = {
  title: "개인정보 처리방침",
};

export default function PrivacyPage() {
  const contactEmail = privacyContactEmail();

  return (
    <main className="page-main narrow-main">
      <article className="auth-panel" aria-labelledby="privacy-title">
        <h1 id="privacy-title">개인정보 처리방침</h1>
        <p className="prose-text">
          SOULBOUND 운영팀은 SOULBOUND 서비스를 운영하면서 개인정보를 어떻게
          처리하는지 이 방침으로 알립니다. 시행일: 2026년 10월 6일.
        </p>

        <section aria-labelledby="privacy-purpose">
          <h2 id="privacy-purpose">1. 처리 목적</h2>
          <ul className="prose-text">
            <li>아이디와 비밀번호로 계정을 만들고 로그인 상태를 유지합니다.</li>
            <li>입장 신청을 받아 검토자 심사 또는 기존 멤버의 비밀투표로 입장 여부를 정합니다.</li>
            <li>멤버 전용 게시판을 제공하고, 신고와 차단으로 이용을 보호합니다.</li>
            <li>심사·신고 처리·계정 삭제 같은 운영 기록이 나중에 바뀌었는지 확인합니다.</li>
          </ul>
          <p className="prose-text">
            위 목적 외에 광고나 마케팅을 위해 개인정보를 처리하지 않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-items">
          <h2 id="privacy-items">2. 처리 항목</h2>
          <p className="prose-text">
            실명, 전화번호, 이용자가 입력한 이메일 주소, 주소, 생년월일, 그 밖의
            본인 확인 정보는 받지 않습니다. 광고 식별자, 이용 분석 도구, 오류
            자동 보고, 푸시 알림 토큰도 수집하지 않습니다.
          </p>
          <ul className="prose-text">
            <li>
              계정: 아이디(username, 3~24자), 비밀번호. 비밀번호는 Supabase Auth가
              해시로 저장하며 운영팀은 원문을 알 수 없습니다. 로그인용으로
              <code>아이디@soulbound.internal</code> 형식의 내부 주소만 만듭니다.
              이 주소는 이용자의 메일함이 아니며, 이 주소로 메일을 보내지 않습니다.
            </li>
            <li>
              회원 상태: 역할(신청자, 멤버, 검토자, 관리자), 멤버십 상태, 멤버 번호.
              다른 멤버에게는 멤버 번호(<code>soulbound-member-N</code>)만 보입니다.
              아이디는 검토자와 관리자 화면에 보입니다.
            </li>
            <li>
              입장 신청: 자기소개 등 신청 본문, 동기, 추천 코드, 신청 상태, 심사
              사유 코드, 신청자에게 보이는 안내 문구, 검토 요약, 처리 시각.
              Persona Clip은 웹에서만 선택 사항이며, 없어도 신청할 수 있습니다.
              iPhone 앱은 Persona Clip 녹화를 제공하지 않습니다.
            </li>
            <li>
              Persona Clip: 심사용 짧은 영상·음성 원본, 내용 해시, 형식, 크기,
              상태, 삭제 사유 코드. 원본은 비공개 저장소 <code>persona-clips</code>에
              둡니다. 파일 올리기, 미리보기, 다시 찍기는 제공하지 않습니다.
            </li>
            <li>
              게시판: 게시글 본문(최대 2,000자), 댓글 본문(최대 1,200자), 작성 시각,
              위조 확인용 해시.
            </li>
            <li>
              입장 투표: 참여 여부와 시각(분 단위). 찬성·반대 선택은 참여자와
              분리된 표로 저장되며, 투표가 닫히면 그 표는 지웁니다. 투표 중
              Persona Clip을 열람한 기록(누가, 언제, 만료 시각)은 별도로 남습니다.
            </li>
            <li>
              신고: 대상(게시글, 댓글, 멤버 번호), 사유 코드, 선택 입력한 설명
              (최대 500자), 처리 상태와 처리 코드, 처리 시각.
            </li>
            <li>
              차단: 내가 차단한 멤버 목록과 시각. 차단당한 사람은 누가 자신을
              차단했는지 볼 수 없습니다.
            </li>
            <li>
              운영 기록(감사 로그): 행위자·대상의 내부 식별자, 행위 종류, 사유
              코드, 상태 전이 같은 코드 값, 시각. 신청 본문이나 자유 서술 텍스트는
              넣지 않으며, 각 행은 이전 행과 해시로 연결됩니다.
            </li>
            <li>
              기기 저장: 아래 “자동 수집 장치”에 적은 세션과 화면 상태.
            </li>
          </ul>
          <p className="prose-text">
            이 서비스의 데이터베이스에는 IP 주소를 저장하지 않습니다. 웹을
            호스팅하는 Vercel과 데이터베이스를 운영하는 Supabase가 접속·요청
            로그를 각자의 정책에 따라 남길 수 있습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">3. 처리 및 보유 기간</h2>
          <ul className="prose-text">
            <li>
              계정, 아이디, 비밀번호 해시, 내부 로그인 주소, 프로필, 멤버십,
              내가 쓴 게시글·댓글, 차단 목록, 투표 영상 열람 기록: 계정을 삭제할
              때까지. 게시글·댓글과 차단은 그 전에 이용자가 직접 지울 수 있습니다.
            </li>
            <li>
              진행 중인 입장 신청 본문: 심사가 끝나거나 계정을 삭제할 때까지.
              승인 또는 거절이 확정되면 신청 본문(자기소개, 동기, 추천 코드)과
              신청서에 붙은 클립 참조·해시는 그 자리에서 지웁니다. 신청자에게
              보이는 안내 문구와 검토 요약은 신청 행에 남을 수 있고, 계정을
              삭제하면 신청 행과 함께 지워집니다.
            </li>
            <li>
              Persona Clip 원본: 승인 또는 거절이 확정되면 즉시 삭제 대상으로
              표시됩니다. 제출하지 않은 임시 파일은 만들어진 시점부터 24시간
              뒤에 삭제 대상이 됩니다. 배포 환경에서는 매일 18:00 UTC에 한 번
              삭제 작업이 비공개 저장소에서 대상 파일을 지웁니다. 계정 삭제
              요청 안에서는 그 계정의 원본을 바로 지웁니다. 파일은 영구 보관하지
              않습니다. 내용 해시와 삭제 사유 코드는 계정 삭제로 해당 행이
              사라질 때까지 남을 수 있습니다.
            </li>
            <li>
              신고: 따로 정한 짧은 기간 없이, 서비스를 운영하는 동안 처리 기록으로
              남깁니다. 신고자, 대상자, 처리자가 계정을 삭제하면 그 계정과의
              연결은 끊고(식별자를 비움) 사유 코드·설명·대상 참조는 남깁니다.
              멤버 번호는 계정이 없으면 더 이상 사람에게 연결되지 않습니다.
            </li>
            <li>
              감사 로그: 해시 연결을 유지해야 하므로 행을 고치거나 지우지 않습니다.
              계정을 삭제해도 내부 식별자는 남지만, 계정 행과의 연결은 끊어져
              그 식별자만으로는 사람을 특정할 수 없습니다. 서비스를 운영하는 동안
              무결성 확인을 위해 보관합니다.
            </li>
            <li>
              투표 참여 기록: 계정이 있는 동안에는 어떤 계정이 투표에 참여했는지와
              분 단위 시각이 연결됩니다. 찬성·반대 값은 그 기록에 없고, 투표가
              닫히면 선택 표 자체는 삭제됩니다. 계정을 삭제하면 참여 기록의
              식별자는 계정과 끊긴 채 남으며, 익명 표 수와 참여자 수가 맞는지
              확인하려고 서비스를 운영하는 동안 보관합니다.
            </li>
            <li>
              접속·요청 로그: SOULBOUND는 별도로 보관하지 않습니다. Vercel과
              Supabase가 각자의 정책에서 정한 기간 동안 보관할 수 있습니다.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-destruction">
          <h2 id="privacy-destruction">4. 파기 절차 및 방법</h2>
          <ul className="prose-text">
            <li>
              계정 삭제는 iPhone 앱의 설정 → 계정 삭제에서 확인 후 즉시 실행됩니다.
              같은 삭제는 로그인 세션으로 웹 API <code>DELETE /api/account</code>에
              확인 값 <code>DELETE_MY_ACCOUNT</code>를 보내 요청할 수 있습니다.
              삭제는 되돌릴 수 없습니다.
            </li>
            <li>
              즉시 삭제: 인증 계정과 비밀번호 해시, 프로필(아이디, 멤버 번호),
              멤버십, 내 입장 신청 행, Persona Clip 원본과 그 기록 행, 내 게시글·
              댓글, 차단 목록, 투표 영상 열람 기록.
            </li>
            <li>
              연결을 끊고 남김: 다른 사람의 신청에 대해 내가 한 심사 행위(행위자
              정보 제거), 내가 접수하거나 처리한 신고(사람 식별자 제거), 투표
              참여 집계(계정과 끊긴 식별자), 감사 로그(계정과 끊긴 식별자와 코드).
            </li>
            <li>
              전자 파일은 데이터베이스에서 행을 지우거나 해당 칸을 비우고,
              Persona Clip 원본은 비공개 저장소에서 삭제합니다. 종이 문서는
              만들지 않습니다.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-third">
          <h2 id="privacy-third">5. 제3자 제공</h2>
          <p className="prose-text">
            개인정보를 판매하지 않으며, 서비스 운영 위탁 외에 제3자에게 제공하지
            않습니다. 외부 원장이나 블록체인에 개인정보를 기록하지 않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-entrust">
          <h2 id="privacy-entrust">6. 처리 위탁 및 국외 이전</h2>
          <p className="prose-text">
            아래 업체는 서비스를 돌리기 위해 개인정보를 처리합니다. 데이터는
            이용 시점에 네트워크로 그 업체의 서버에서 처리되며, 서버는 대한민국
            밖(각 제공자가 운영하는 해외 리전)에 있을 수 있습니다.
          </p>
          <ul className="prose-text">
            <li>
              Supabase: 데이터베이스, 인증, Persona Clip 파일 저장. 이전 항목은
              계정(내부 로그인 주소, 비밀번호 해시, 아이디), 회원 상태, 입장 신청,
              영상·음성 원본, 게시글·댓글, 투표 기록, 신고, 차단, 감사 로그입니다.
            </li>
            <li>
              Vercel: 웹 화면과 API 호스팅. 이전 항목은 각 요청의 내용(신청 본문,
              게시글, 신고, 로그인 토큰이 포함된 요청)과, 제공자가 남기는 접속
              로그입니다.
            </li>
          </ul>
          <p className="prose-text">
            국외 이전을 원하지 않으면 서비스를 이용하지 않으면 됩니다. 이미
            계정이 있으면 계정을 삭제하면 이 서비스가 보관하는 본인 데이터는
            위 파기 기준대로 지워지거나 연결이 끊깁니다. 제공자가 자체 정책으로
            남기는 접속 로그는 그 정책에 따릅니다.
          </p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">7. 정보주체의 권리·의무 및 행사 방법</h2>
          <p className="prose-text">
            이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할
            수 있습니다. 서비스 안에서 직접 할 수 있는 일은 다음과 같습니다.
            iPhone 앱에서 계정 삭제, 웹과 iPhone 앱에서 내 게시글·댓글 삭제,
            iPhone 앱에서 차단과 차단 해제, 진행 중인 입장 신청의 보완 제출.
          </p>
          <p className="prose-text">
            그 밖의 요구는 {contactEmail} 로 보내 주세요. 요구를 받은 날부터
            10일 안에 조치하고 결과를 알립니다. 법정대리인이나 위임을 받은
            대리인도 요구할 수 있으며, 위임 관계를 확인하는 자료를 요청할 수
            있습니다. 비밀번호는 운영팀도 원문을 보지 못하므로, 분실하면 계정을
            복구할 수 없습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-child">
          <h2 id="privacy-child">8. 만 14세 미만</h2>
          <p className="prose-text">
            만 14세 미만은 가입할 수 없습니다. 생년월일 등 나이를 확인하는
            정보는 수집하지 않습니다. 이 기준은 이용약관과 같습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-auto">
          <h2 id="privacy-auto">9. 자동 수집 장치</h2>
          <ul className="prose-text">
            <li>
              웹 로그인 세션은 브라우저 localStorage에 저장됩니다. 앱 코드가
              쿠키를 설정하지 않습니다. 광고·분석 추적기는 없습니다.
            </li>
            <li>
              sessionStorage에는 마지막으로 연 입장 신청의 식별자
              (<code>soulbound:last-application-id</code>)만 둡니다.
            </li>
            <li>
              localStorage에는 앱 설치 안내를 닫은 시각
              (<code>soulbound.pwa.install-dismissed-at</code>)을 둘 수 있습니다.
              그 안내는 14일 동안 다시 띄우지 않습니다.
            </li>
            <li>
              서비스 워커의 Cache Storage에는 공개 화면과 정적 파일을 둘 수
              있습니다. 회원 화면, 신청, 관리, API, Persona Clip은 캐시하지
              않습니다.
            </li>
            <li>
              iPhone 앱은 로그인 세션을 iOS Keychain(SecureStore,
              이 기기에서 첫 잠금 해제 이후)에 저장합니다. 세션이 길면 나누어
              저장합니다. 차단한 멤버 번호 목록의 임시 복사본도 같은 저장소에
              둡니다. 서버의 차단 목록이 기준입니다. 분석, 오류 자동 보고, 푸시
              알림은 사용하지 않습니다.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-security">
          <h2 id="privacy-security">10. 안전성 확보 조치</h2>
          <ul className="prose-text">
            <li>데이터베이스 행은 행 단위 보안 정책(RLS)과 역할(신청자, 멤버, 검토자, 관리자)로 접근을 제한합니다.</li>
            <li>비밀번호는 Supabase Auth가 해시로 저장합니다.</li>
            <li>배포된 웹과 API는 HTTPS로 통신합니다.</li>
            <li>관리용 서비스 롤 키는 서버 환경 변수로만 두며 브라우저에 넣지 않습니다.</li>
            <li>Persona Clip 저장소는 비공개이며, 열람 주소는 짧은 시간(5분)만 유효합니다.</li>
            <li>감사 로그는 코드와 식별자만 해시 체인으로 연결합니다.</li>
            <li>신고 처리 화면은 신고자의 내부 식별자를 돌려주지 않습니다.</li>
          </ul>
        </section>

        <section aria-labelledby="privacy-officer">
          <h2 id="privacy-officer">11. 개인정보 보호책임자 및 연락처</h2>
          <p className="prose-text">
            개인정보 보호책임자: SOULBOUND 운영팀 (개인정보 보호책임자)
            <br />
            연락처: {contactEmail}
          </p>
          <p className="prose-text">
            개인정보 처리에 관한 문의, 열람·정정·삭제·처리정지 요구는 위 주소로
            보내 주세요.
          </p>
        </section>

        <section aria-labelledby="privacy-remedy">
          <h2 id="privacy-remedy">12. 권익침해 구제 방법</h2>
          <ul className="prose-text">
            <li>개인정보분쟁조정위원회: 1833-6972, www.kopico.go.kr</li>
            <li>개인정보침해신고센터: 118, privacy.kisa.or.kr</li>
            <li>대검찰청: 1301, www.spo.go.kr</li>
            <li>경찰청: 182, ecrm.police.go.kr</li>
          </ul>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">13. 처리방침의 변경</h2>
          <p className="prose-text">
            이 방침이 바뀌면 시행일과 함께 이 페이지에 게시합니다.
          </p>
        </section>

        <section aria-labelledby="privacy-effective">
          <h2 id="privacy-effective">14. 시행일</h2>
          <p className="prose-text">이 방침은 2026년 10월 6일부터 시행합니다.</p>
        </section>

        <section aria-labelledby="privacy-en">
          <h2 id="privacy-en">English summary</h2>
          <p className="prose-text">
            SOULBOUND stores a username and a password hash. It does not collect
            a real name, phone number, or an email address the user typed. Sign-in
            uses an internal address of the form username@soulbound.internal, to
            which no mail is sent. The service also stores
            membership status and member number, admission text until a decision
            shreds it, optional Persona Clip media (marked for deletion when review
            ends, or 24 hours after an unsubmitted clip is created, then removed by
            a daily job; removed immediately on account deletion), board posts and
            comments, vote participation separated from the yes/no choice, reports,
            blocks, and a codes-only hash-chained audit log. Account deletion in
            the iPhone app (Settings → Delete account) or via DELETE /api/account
            removes owned data at once and leaves operational records unlinked.
            Those unlinked records are kept for as long as the service operates.
            Processors are Supabase (database, auth, storage) and Vercel (hosting
            and API), on the providers&apos; infrastructure, which may be outside
            Korea. There are no advertising or analytics trackers. Contact:
            {" "}{contactEmail}. Effective 6 October 2026.
          </p>
        </section>

        <p className="prose-text">
          관련 문서: <Link href="/terms">이용약관</Link>
        </p>
      </article>
    </main>
  );
}
