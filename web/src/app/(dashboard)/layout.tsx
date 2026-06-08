import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.hasAccess) redirect("/pending");

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        user={{
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
