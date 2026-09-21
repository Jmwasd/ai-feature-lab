import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CommitNotFound() {
  return (
    <EmptyState
      status="404 · 커밋 없음"
      title="커밋 목록에서 다시 선택한다"
      description="이 저장소에서 커밋을 찾지 못했다. 목록으로 돌아가 확인한다."
      action={<ButtonLink href="/repo">← 커밋 목록</ButtonLink>}
    />
  );
}
