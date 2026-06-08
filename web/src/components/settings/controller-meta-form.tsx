import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// 컨트롤러 메타데이터: 컨트롤러 번호(idx/eqpmnNo)에 사용자 지정 이름 부여.
// 신규 테이블 없이 추후 저장 위치 결정. UI 표현은 ControllerNameLabel 과 연동.
export function ControllerMetaForm() {
  return (
    <SectionCard
      title="4. 컨트롤러 이름(메타데이터) 설정"
      description="컨트롤러 번호에 사용자 지정 이름을 부여하면 전체 화면에서 해당 이름으로 표시됩니다."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">컨트롤러 번호</TableHead>
            <TableHead className="w-28">장비 번호</TableHead>
            <TableHead>사용자 지정 이름</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">#{i + 1}</TableCell>
              <TableCell className="text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </TableCell>
              <TableCell>
                <Input placeholder={`예) ${i + 1}번 송풍 라인`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
