import { SectionCard } from "@/components/common/section-card";

type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

/** Admin health — dashboard SectionCard(lg) 통일 */
export function HealthSectionCard({ title, description, children }: Props) {
  return (
    <SectionCard title={title} description={description} size="lg">
      {children}
    </SectionCard>
  );
}
