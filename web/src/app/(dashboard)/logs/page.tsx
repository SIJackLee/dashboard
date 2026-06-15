import { redirect } from "next/navigation";

/** 연결 복구(REPLAY)는 컨트롤러 페이지 패널에서 확인 */
export default function LogsPage() {
  redirect("/controllers");
}
