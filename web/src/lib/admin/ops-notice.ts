export type OpsNotice = { tone: "ok" | "error"; text: string };

const noticeByCode: Record<string, { tone: "ok" | "error"; text: string }> = {
  granted: { tone: "ok", text: "권한을 부여했습니다." },
  bulk_granted: { tone: "ok", text: "농장 권한을 일괄 부여했습니다." },
  revoked: { tone: "ok", text: "권한을 회수했습니다." },
  role_updated: { tone: "ok", text: "역할을 변경했습니다." },
  notfound: { tone: "error", text: "해당 이메일의 가입자를 찾을 수 없습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
  forbidden: { tone: "error", text: "관리자 권한이 필요합니다." },
  self_demote: {
    tone: "error",
    text: "본인 계정의 관리자 역할은 해제할 수 없습니다.",
  },
  saved: { tone: "ok", text: "저장했습니다." },
  save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
};

export function resolveOpsNotice(params: {
  ok?: string;
  error?: string;
  count?: string;
}): OpsNotice | null {
  const { ok, error, count } = params;
  let notice = ok ? noticeByCode[ok] : error ? noticeByCode[error] : null;
  if (ok === "bulk_granted" && count) {
    notice = {
      tone: "ok",
      text: `${count}개 농장 권한을 일괄 부여했습니다.`,
    };
  }
  return notice;
}
