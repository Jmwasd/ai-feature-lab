import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-editorial flex-col items-start gap-base px-gutter py-section">
      <p className="text-caption text-muted">404</p>
      <h1 className="text-display-xl text-ink">페이지를 찾을 수 없어요</h1>
      <p className="max-w-detail text-body-md text-body">주소가 바뀌었거나 없는 페이지예요. 처음 화면에서 다시 시작해 주세요</p>
      <Button href="/">처음으로</Button>
    </main>
  );
}
