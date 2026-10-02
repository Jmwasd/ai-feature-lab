import { Calculator, Clock, Database, House } from "lucide-react";
import { FooterLight } from "@/components/FooterLight";
import { TopNav } from "@/components/TopNav";
import { AuthNavAction } from "@/features/auth/AuthNavAction";
import { CasesSection } from "./_components/CasesSection";
import { FinalCta } from "./_components/FinalCta";
import { FlowSection } from "./_components/FlowSection";
import { Hero } from "./_components/Hero";
import { LoginNotice } from "./_components/LoginNotice";
import { SourcesSection } from "./_components/SourcesSection";
import { TrySection } from "./_components/TrySection";

const NAV_ICON = { "aria-hidden": true, size: 16 } as const;

const NAV_LINKS = [
  { href: "#try", label: "계산해 보기", icon: <Calculator {...NAV_ICON} /> },
  { href: "#cases", label: "사례", icon: <House {...NAV_ICON} /> },
  { href: "#flow", label: "이용 방법", icon: <Clock {...NAV_ICON} /> },
  { href: "#sources", label: "데이터 출처", icon: <Database {...NAV_ICON} /> },
];

// 랜딩 시안 푸터 문구 중 실제로 있는 페이지만 남긴다.
const FOOTER_COLUMNS = [
  {
    title: "서비스",
    links: [
      { href: "/check", label: "위험 진단" },
      { href: "/saved", label: "저장한 결과" },
    ],
  },
  { title: "jeonse-check", links: [{ href: "/#sources", label: "데이터 출처" }] },
];

// UI_GUIDE §8 랜딩 구성 순서대로 조합만 한다.
// callbackUrl 쿼리는 proxy가 보호 경로에서 보냈다는 뜻이라 히어로 앞에 로그인 안내를 둔다.
export default async function Home({ searchParams }: PageProps<"/">) {
  const { callbackUrl } = await searchParams;

  return (
    <>
      <TopNav links={NAV_LINKS} action={<AuthNavAction />} />
      <main>
        {callbackUrl !== undefined && <LoginNotice callbackUrl={typeof callbackUrl === "string" ? callbackUrl : ""} />}
        <Hero />
        <TrySection />
        <CasesSection />
        <FlowSection />
        <SourcesSection />
        <FinalCta />
      </main>
      <FooterLight columns={FOOTER_COLUMNS} legal="© 2026 jeonse-check" />
    </>
  );
}
