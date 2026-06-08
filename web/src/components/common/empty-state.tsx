import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-background py-20 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
