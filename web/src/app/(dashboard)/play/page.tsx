import { redirect } from "next/navigation";

/** 레거시 /play — Piggy Jump 제거, 모니터링 허브로 redirect */
export default function PlayLegacyRedirectPage() {
  redirect("/farm");
}
