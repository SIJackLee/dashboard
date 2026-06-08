import { TopBar } from "./top-bar";

type PageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function PageShell({ title, children }: PageShellProps) {
  return (
    <>
      <TopBar title={title} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-screen-2xl space-y-6">{children}</div>
      </main>
    </>
  );
}
