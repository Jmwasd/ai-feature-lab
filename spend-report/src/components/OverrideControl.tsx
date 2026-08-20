import type { Category, ClassifiedTx, Override } from "../types/report";

interface OverrideControlProps {
  item: ClassifiedTx;
  override?: Override;
  onChange: (id: string, override: Override) => void;
}

const categories: Category[] = [
  "식비",
  "카페",
  "배달",
  "식료품",
  "생활",
  "교통",
  "숙박",
  "문화",
  "의료",
  "수수료/기타",
];

export default function OverrideControl({ item, override, onChange }: OverrideControlProps) {
  const isExcluded = override?.excluded === true;
  const category = override?.category ?? "";

  function selectCategory(nextCategory: Category): void {
    onChange(item.id, { category: nextCategory, excluded: false });
  }

  function include(): void {
    onChange(item.id, { ...(override?.category ? { category: override.category } : {}), excluded: false });
  }

  function exclude(): void {
    onChange(item.id, { ...(override?.category ? { category: override.category } : {}), excluded: true });
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`category-${item.id}`}>
        {item.displayName} 카테고리
      </label>
      <select
        className="rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:text-text-muted"
        disabled={isExcluded}
        id={`category-${item.id}`}
        value={category}
        onChange={(event) => {
          if (event.target.value) {
            selectCategory(event.target.value as Category);
          }
        }}
      >
        <option value="">카테고리</option>
        {categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className="flex rounded-full bg-fill-subtle p-0.5">
        <button
          aria-pressed={!isExcluded}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
            !isExcluded ? "bg-ink text-bg" : "text-text-muted"
          }`}
          type="button"
          onClick={include}
        >
          소비
        </button>
        <button
          aria-pressed={isExcluded}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
            isExcluded ? "bg-blue text-bg" : "text-text-muted"
          }`}
          type="button"
          onClick={exclude}
        >
          소비 아님
        </button>
      </div>
    </div>
  );
}
