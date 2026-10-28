import { FooterLight } from "@/components/FooterLight";
import { AuthTopNav } from "@/features/auth/AuthTopNav";
import { LandingStory } from "./_components/LandingStory";
import { LoginNotice } from "./_components/LoginNotice";

// 랜딩 시안 푸터 문구 중 실제로 있는 페이지만 남긴다.
const FOOTER_COLUMNS = [
  {
    title: "서비스",
    links: [
      { href: "/check", label: "위험 진단" },
      { href: "/saved", label: "저장한 결과" },
    ],
  },
  { title: "jeonse-check", links: [{ href: "/chat-log", label: "채팅 로그" }] },
];

// 랜딩은 3D 스크롤 장면 하나다(design/jeonse-check Landing 3D). GNB는 장면 위에 띄운다.
// callbackUrl 쿼리는 proxy가 보호 경로에서 보냈다는 뜻이라 GNB 아래에 로그인 안내를 띄운다.
export default async function Home({ searchParams }: PageProps<"/">) {
  const { callbackUrl } = await searchParams;

  return (
    <>
      <main>
        <LandingStory
          nav={<AuthTopNav links={[]} overlay />}
          notice={callbackUrl !== undefined ? <LoginNotice callbackUrl={typeof callbackUrl === "string" ? callbackUrl : ""} /> : undefined}
        />
      </main>
      <FooterLight columns={FOOTER_COLUMNS} legal="© 2026 jeonse-check" />
    </>
  );
}
