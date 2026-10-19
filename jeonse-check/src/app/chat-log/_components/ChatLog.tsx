// 개발 대화 기록. 데이터는 chat-logs 스킬의 생성기(build_chat_logs.py --json)가 만든다.
// 질문·답변 본문은 생성기가 마크다운을 변환한 HTML 조각이다. 원문 보존이 목적이라 여기서 문장을 고치지 않는다.

export type ChatLogPair = {
  askedAt: string;
  summary: string;
  questionHtml: string;
  answerHtml: string;
};

export type ChatLogSession = {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string;
  branch: string | null;
  model: string | null;
  source: string;
  pairs: ChatLogPair[];
};

export type ChatLogData = {
  project: string;
  generatedAt: string;
  questionCount: number;
  sessions: ChatLogSession[];
};

// 생성기가 만드는 HTML 조각(p·목록·코드·표·인용)에 토큰 스타일을 입힌다.
const PROSE = [
  "min-w-0 break-words text-body-md text-body",
  "[&_p]:my-sm [&_.mdh]:mt-base [&_.mdh]:text-title-md [&_.mdh]:text-ink [&_strong]:font-semibold [&_strong]:text-ink",
  "[&_ul]:my-sm [&_ul]:list-disc [&_ul]:pl-lg [&_ol]:my-sm [&_ol]:list-decimal [&_ol]:pl-lg [&_li]:my-xs",
  "[&_code]:rounded-sm [&_code]:bg-surface-strong [&_code]:px-xs [&_code]:text-body-sm",
  "[&_pre]:my-sm [&_pre]:overflow-x-auto [&_pre]:rounded-card [&_pre]:bg-surface-soft [&_pre]:p-base [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_.tw]:my-sm [&_.tw]:overflow-x-auto [&_table]:text-body-sm [&_th]:border [&_th]:border-hairline [&_th]:bg-surface-soft [&_th]:px-sm [&_th]:py-xs [&_th]:text-left",
  "[&_td]:border [&_td]:border-hairline [&_td]:px-sm [&_td]:py-xs",
  "[&_blockquote]:my-sm [&_blockquote]:border-l-2 [&_blockquote]:border-hairline [&_blockquote]:pl-base [&_blockquote]:text-muted",
  "[&_hr]:my-base [&_hr]:border-hairline-soft [&_a]:text-ink [&_a]:underline",
].join(" ");

// 목차 링크로 이동했을 때 질문이 상단 바 밑에 가리지 않게 한다.
const ANCHOR_OFFSET = "scroll-mt-[calc(var(--spacing-nav)+var(--spacing-base))]";

const pairId = (session: ChatLogSession, index: number) => `${session.id}-q${index + 1}`;

export function ChatLog({ data }: { data: ChatLogData }) {
  return (
    <div className="mx-auto grid w-full max-w-editorial gap-xl px-gutter py-section desktop:grid-cols-[280px_minmax(0,1fr)]">
      <Toc sessions={data.sessions} questionCount={data.questionCount} />
      <div className="flex min-w-0 flex-col gap-xxl">
        <header className="flex flex-col gap-sm">
          <h1 className="text-display-xl text-ink">채팅 로그</h1>
          <p className="text-body-sm text-muted tabular-nums">
            세션 {data.sessions.length}개 · 질문 {data.questionCount}개 · {data.generatedAt} 생성
          </p>
          <p className="text-body-sm text-body">
            {data.project}를 만들며 나눈 질문과 답변을 원문 그대로 모았어요. 도구 호출과 시스템 메시지는 뺐어요.
          </p>
        </header>
        {data.sessions.map((session) => (
          <Session key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

function Toc({ sessions, questionCount }: { sessions: ChatLogSession[]; questionCount: number }) {
  const dates = [...new Set(sessions.map((session) => session.date))];
  const byDate = dates.map((date) => [date, sessions.filter((session) => session.date === date)] as const);

  return (
    <aside className="hidden flex-col gap-lg desktop:sticky desktop:top-[calc(var(--spacing-nav)+var(--spacing-lg))] desktop:flex desktop:max-h-[calc(100vh-var(--spacing-nav)-var(--spacing-xxl))] desktop:self-start desktop:overflow-y-auto">
      <Summary sessionCount={sessions.length} questionCount={questionCount} dates={dates} />
      <nav aria-label="대화 목차" className="flex flex-col gap-base">
        {byDate.map(([date, group]) => (
          <details key={date} open className="flex flex-col gap-xs">
            <summary className="text-caption text-ink tabular-nums">
              {date} · {group.reduce((sum, session) => sum + session.pairs.length, 0)}
            </summary>
            {group.map((session) => (
              <TocSession key={session.id} session={session} />
            ))}
          </details>
        ))}
      </nav>
    </aside>
  );
}

// 요약 수치 줄(UI_GUIDE §4 SignalSummary의 값 + 라벨 조합)을 3열 격자로 둔다.
// 작업 기간은 첫날~마지막 날 달력 일수가 아니라 세션이 있던 날짜 수다. 쉰 날을 기간에 넣지 않는다.
function Summary({ sessionCount, questionCount, dates }: { sessionCount: number; questionCount: number; dates: string[] }) {
  const metrics = [
    { value: String(sessionCount), label: "세션" },
    { value: String(questionCount), label: "질문" },
    { value: `${dates.length}일`, label: "작업 기간", title: `${dates[0] ?? ""} ~ ${dates.at(-1) ?? ""} 중 실제 작업한 날` },
  ];

  return (
    <ul aria-label="요약 지표" className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-card border border-hairline bg-hairline-soft">
      {metrics.map((metric) => (
        <li key={metric.label} title={metric.title} className="flex flex-col gap-xxs bg-canvas p-md">
          <span className="text-title-md text-ink tabular-nums">{metric.value}</span>
          <span className="text-caption-sm text-muted">{metric.label}</span>
        </li>
      ))}
    </ul>
  );
}

function TocSession({ session }: { session: ChatLogSession }) {
  const detail = [`${session.startedAt}–${session.endedAt}`, session.branch].filter(Boolean).join(" · ");

  return (
    <div className="mt-xs flex flex-col">
      <a href={`#${session.id}`} className="flex items-baseline gap-sm py-xs text-caption-sm text-body hover:text-ink hover:no-underline">
        <span className="font-semibold text-ink">{session.id}</span>{" "}
        <span className="truncate tabular-nums text-muted">{detail}</span>
      </a>
      <ol className="flex flex-col border-l border-hairline">
        {session.pairs.map((pair, index) => (
          <li key={pairId(session, index)}>
            <a
              href={`#${pairId(session, index)}`}
              title={pair.summary}
              className="flex gap-sm truncate py-xs pl-md text-caption-sm text-muted hover:bg-surface-soft hover:text-ink hover:no-underline"
            >
              <span className="shrink-0 tabular-nums text-muted-soft">{pair.askedAt}</span>
              <span className="truncate">{pair.summary}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Session({ session }: { session: ChatLogSession }) {
  const meta = [
    `${session.startedAt}–${session.endedAt} KST`,
    session.branch,
    session.model,
    session.source,
    `질문 ${session.pairs.length}개`,
  ].filter((item): item is string => Boolean(item));

  return (
    <section aria-labelledby={session.id} className="flex flex-col gap-lg border-t border-hairline-soft pt-lg">
      <header className="flex flex-col gap-xs">
        <h2 id={session.id} className={`flex items-baseline gap-sm text-display-sm text-ink tabular-nums ${ANCHOR_OFFSET}`}>
          {session.date}
          <span className="text-caption-sm text-muted">{session.id}</span>
        </h2>
        <p className="text-caption-sm text-muted tabular-nums">{meta.join(" · ")}</p>
      </header>
      {session.pairs.map((pair, index) => (
        <article key={pairId(session, index)} id={pairId(session, index)} className={`flex flex-col gap-base ${ANCHOR_OFFSET}`}>
          <Turn label="Q" stamp={pair.askedAt} html={pair.questionHtml} question />
          <Turn label="A" html={pair.answerHtml} />
        </article>
      ))}
    </section>
  );
}

function Turn({ label, stamp, html, question = false }: { label: string; stamp?: string; html: string; question?: boolean }) {
  return (
    <div className={`flex flex-col gap-xs ${question ? "rounded-card bg-surface-soft p-base" : ""}`}>
      <p className="flex gap-sm text-caption text-ink">
        {label}
        {stamp ? <span className="text-caption-sm text-muted tabular-nums">{stamp}</span> : null}
      </p>
      {/* 생성기가 html.escape로 원문을 이스케이프하고 http(s)·앵커 링크만 a 태그로 만든 조각이다. */}
      <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
