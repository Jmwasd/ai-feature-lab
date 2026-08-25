import type { ChangeEvent } from "react";

import {
  isCategory,
  SELECTABLE_CATEGORIES,
  type Category,
  type ClassifiedTx,
  type Override,
} from "../types/report";

interface OverrideControlProps {
  item: ClassifiedTx;
  override?: Override;
  onChange: (id: string, override: Override) => void;
}

export default function OverrideControl({ item, override, onChange }: OverrideControlProps) {
  const isExcluded = override?.excluded === true;
  const category = override?.category ?? "";

  function selectCategory(nextCategory: Category): void {
    onChange(item.id, { category: nextCategory, excluded: false });
  }

  function include(): void {
    setExcluded(false);
  }

  function exclude(): void {
    setExcluded(true);
  }

  function setExcluded(excluded: boolean): void {
    const categoryOverride = override?.category;
    onChange(item.id, categoryOverride ? { category: categoryOverride, excluded } : { excluded });
  }

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextCategory = event.target.value;

    if (isCategory(nextCategory) && nextCategory !== "미분류") {
      selectCategory(nextCategory);
    }
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
        onChange={handleCategoryChange}
      >
        <option value="">카테고리</option>
        {SELECTABLE_CATEGORIES.map((option) => (
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
