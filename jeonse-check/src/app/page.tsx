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

const NAV_LINKS = [
  { href: "#try", label: "계산해 보기" },
  { href: "#cases", label: "사례" },
  { href: "#flow", label: "이용 방법" },
  { href: "#sources", label: "데이터 출처" },
];

const FOOTER_COLUMNS = [
  {
    title: "고객지원",
    links: [
      { href: "/#flow", label: "이용 방법" },
      { href: "/#sources", label: "데이터 출처" },
    ],
  },
  {
    title: "서비스",
    links: [
      { href: "/check", label: "지금 확인하기" },
      { href: "/#try", label: "계산해 보기" },
      { href: "/#cases", label: "사례" },
    ],
  },
  { title: "jeonse-check", links: [{ href: "/", label: "처음으로" }] },
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
