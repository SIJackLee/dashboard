import { PlugZap } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const fields = [
  { key: "broker", label: "MQTT 브로커" },
  { key: "port", label: "MQTT 포트" },
  { key: "client_id", label: "아이디" },
  { key: "password", label: "비밀번호", type: "password" },
  { key: "sub_topic", label: "수신 토픽" },
  { key: "pub_topic", label: "발행 토픽" },
];

export function MqttConfigForm() {
  return (
    <SectionCard title="5. MQTT / 서버 연결 설정">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <Input type={f.type ?? "text"} placeholder="--" />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Switch id="tls" />
          <Label htmlFor="tls" className="text-sm">
            보안 연결 (TLS)
          </Label>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md border py-2 text-sm hover:bg-muted">
          <PlugZap className="size-4" /> 연결 테스트
        </button>
      </div>
    </SectionCard>
  );
}
