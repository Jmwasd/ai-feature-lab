"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 열고 닫는 전환 시간. 닫을 때는 이 시간이 지난 뒤 내린다. */
export const MODAL_TRANSITION_MS = 300;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  // 패널 제목 요소의 id. 스크린 리더가 dialog 이름으로 읽는다.
  labelledBy: string;
  describedBy?: string;
  closeLabel?: string;
  children?: ReactNode;
};

// 화면을 흰 막으로 덮고 가운데 흰 패널을 띄운다(UI_GUIDE §4 Modal).
// 막은 opacity만, 패널은 opacity·translateY·blur를 바꿔 부드럽게 열고 닫는다(UI_GUIDE §5 이징).
export function Modal({ open, onClose, labelledBy, describedBy, closeLabel = "닫기", children }: ModalProps) {
  // mounted: DOM에 있는지. visible: 보이는 상태로 전환했는지. 닫을 때는 visible을 먼저 내리고 전환 뒤 mounted를 내린다.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  if (open && !mounted) setMounted(true);
  if (!open && visible) setVisible(false);

  useEffect(() => {
    if (!open || !mounted) return;
    // 숨긴 상태가 한 번 그려진 다음 프레임에 보이는 상태로 바꿔야 전환이 일어난다.
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open, mounted]);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), MODAL_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  // 열려 있는 동안 페이지 스크롤을 막고, 패널 안으로 포커스를 옮겼다가 내릴 때 연 요소로 돌려준다.
  useEffect(() => {
    if (!mounted) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusables(panelRef.current)[0]?.focus();
    // 패널 안 글자를 눌러 포커스가 body로 빠져도 Esc·Tab이 동작하도록 document에서 받는다.
    const onKeyDown = (event: KeyboardEvent) => trapKeys(event, panelRef.current, () => onCloseRef.current());
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  const state = visible ? "open" : "closed";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center px-gutter">
      <div
        data-testid="modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 bg-canvas/70 transition-opacity duration-300 ease-fade ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-state={state}
        className={`relative w-full max-w-[400px] rounded-card bg-canvas p-lg shadow-float transition-[opacity,translate,filter] duration-300 ease-rise ${
          visible ? "translate-y-0 opacity-100 blur-none" : "translate-y-4 opacity-0 blur-xs"
        }`}
      >
        {children}
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute top-md right-md inline-flex size-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-soft"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}

function trapKeys(event: KeyboardEvent, panel: HTMLElement | null, close: () => void) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusables(panel);
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const inside = panel?.contains(document.activeElement) ?? false;
  if (event.shiftKey && (!inside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}
