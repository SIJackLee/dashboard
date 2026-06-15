import { redirect } from "next/navigation";

export default async function BarnsPage({
  searchParams,
}: {
  searchParams: Promise<{ sp?: string }>;
}) {
  const { sp } = await searchParams;
  const params = new URLSearchParams({ view: "list" });
  if (sp) params.set("sp", sp);
  redirect(`/farm?${params.toString()}`);
}
