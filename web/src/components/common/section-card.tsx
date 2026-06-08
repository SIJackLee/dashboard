import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || action) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
