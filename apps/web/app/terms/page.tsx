import React from "react";

export const metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <main className="page-main narrow-main">
      <article className="auth-panel" aria-labelledby="terms-title">
        <h1 id="terms-title">이용약관</h1>
        <p className="prose-text">시행일: 2026-07-07 (프리알파 v0.1)</p>

        <section aria-labelledby="terms-service">
          <h2 id="terms-service">제1조 (서비스의 성격)</h2>
          <ol className="prose-text">
            <li>
              SoulBound는 입장 심사를 통과한 멤버만 참여하는 비공개 멤버
              공간입니다. 현재는 프리알파 시험 운영 단계로, 기능과 정책이 예고
              후 변경될 수 있습니다.
            </li>
            <li>
              <strong>
                SoulBound는 회원이 실제로 누구인지 알 수 있는 정보를 수집하지
                않는 것을 원칙으로 합니다.
              </strong>{" "}
              운영진은 회원의 실명·연락처·본인 확인 정보를 보유하지 않습니다.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terms-account">
          <h2 id="terms-account">제2조 (계정과 복구 불가)</h2>
          <ol className="prose-text">
            <li>
              계정은 아이디와 비밀번호만으로 만들어지며, 이메일·전화번호 등
              연락처를 수집하지 않습니다.
            </li>
            <li>
              <strong>
                비밀번호를 분실하면 계정과 멤버십을 복구할 수 없습니다.
              </strong>{" "}
              운영자도 복구해 드릴 수 없습니다. 아이디와 비밀번호를 안전한 곳에
              보관해 주세요.
            </li>
            <li>
              복구를 제공하지 않는 이유는 운영진이 회원의 연락처와 본인 확인
              정보를 처음부터 저장하지 않기 때문입니다. 복구 수단이 없는 것이
              아니라, 복구에 쓸 정보 자체를 갖지 않습니다.
            </li>
            <li>계정을 타인에게 양도하거나 공유할 수 없습니다.</li>
          </ol>
        </section>

        <section aria-labelledby="terms-admission">
          <h2 id="terms-admission">제3조 (입장 심사)</h2>
          <ol className="prose-text">
            <li>
              입장 신청 시 자기소개와 선택 사항인 Persona Clip(짧은 영상)을
              제출할 수 있습니다.
            </li>
            <li>
              신청은 검토자 심사 또는 기존 멤버의 비밀투표로 결정됩니다.
              투표에서 각 멤버의 선택은 공개되지 않습니다.
            </li>
            <li>
              신청은 거부될 수 있으며, 결과는 정해진 사유 구분으로만 안내됩니다.
              심사 결과에 대한 이의 절차는 프리알파 기간에는 제공되지 않습니다.
            </li>
            <li>
              타인 사칭, 중복 신원 생성, 허위 자료 제출은 거부 및 멤버십 상실
              사유입니다.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terms-destruction">
          <h2 id="terms-destruction">제4조 (심사 자료의 파기)</h2>
          <p className="prose-text">
            제출한 자기소개와 Persona Clip은 심사 동안만 보관하며, 승인 또는
            거부가 확정되면 파기합니다. Persona Clip 영상 원본은 자동 삭제
            절차로 지워집니다.
          </p>
        </section>

        <section aria-labelledby="terms-anonymity">
          <h2 id="terms-anonymity">제5조 (익명성)</h2>
          <ol className="prose-text">
            <li>
              멤버 사이에서는 익명 멤버 번호만 표시됩니다. 아이디는 운영자와
              검토자에게만 보입니다.
            </li>
            <li>
              다른 멤버의 신원을 알아내려는 시도, 멤버 번호와 실제 인물을
              연결해 공개하는 행위를 금지합니다.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terms-board">
          <h2 id="terms-board">제6조 (게시판과 행동 규범)</h2>
          <ol className="prose-text">
            <li>게시판에는 멤버 번호로만 글과 댓글이 표시됩니다.</li>
            <li>
              불법 정보, 타인의 권리를 침해하는 내용, 괴롭힘, 상업적 스팸을
              금지합니다.
            </li>
            <li>
              운영자는 위반 게시물을 삭제하고, 위반 정도에 따라 멤버십을
              정지하거나 상실시킬 수 있습니다.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terms-data">
          <h2 id="terms-data">제7조 (수집하지 않는 정보와 수집하는 정보)</h2>
          <ol className="prose-text">
            <li>
              <strong>수집하지 않는 정보</strong>: 실명, 이메일, 전화번호, 주소,
              그 밖의 연락처와 본인 확인 정보. 운영진은 회원이 실제로 누구인지
              알 수 있는 정보를 보유하지 않습니다.
            </li>
            <li>
              수집하는 최소한의 정보: 아이디(가명), 비밀번호(암호화 저장),
              심사 자료(한시 보관 후 파기), 게시글과 댓글, 서비스 운영에 필요한
              기록(입장 이력, 감사 기록).
            </li>
            <li>
              투표 기록은 누가 어떻게 투표했는지 식별되지 않는 형태로 관리합니다.
            </li>
            <li>
              수집한 정보를 제3자에게 제공하거나 판매하지 않습니다. 서비스
              운영을 위한 인프라 (데이터 보관·배포)에 한해 처리를 위탁합니다.
            </li>
            <li>만 14세 미만은 가입할 수 없습니다.</li>
          </ol>
        </section>

        <section aria-labelledby="terms-alpha">
          <h2 id="terms-alpha">제8조 (프리알파 고지)</h2>
          <ol className="prose-text">
            <li>
              프리알파 기간에는 서비스가 예고 없이 중단되거나 데이터가 초기화될
              수 있습니다.
            </li>
            <li>
              서비스는 있는 그대로 제공되며, 프리알파 기간의 손해에 대해
              운영자는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.
            </li>
          </ol>
        </section>

        <section aria-labelledby="terms-loss">
          <h2 id="terms-loss">제9조 (멤버십의 상실)</h2>
          <p className="prose-text">
            다음의 경우 멤버십이 상실될 수 있습니다: 본 약관 위반, 비밀번호
            분실(제2조), 본인 요청. 상실된 멤버십은 복구되지 않으며, 재입장은
            새 계정으로 새 심사를 거쳐야 합니다.
          </p>
        </section>

        <section aria-labelledby="terms-change">
          <h2 id="terms-change">제10조 (약관의 변경)</h2>
          <p className="prose-text">
            약관이 바뀌면 시행일과 함께 서비스 안에서 알립니다. 변경 후에도
            서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.
          </p>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact">문의</h2>
          <p className="prose-text">
            프리알파 기간의 문의는 초대를 안내한 운영자에게 해 주세요.
          </p>
        </section>
      </article>
    </main>
  );
}
