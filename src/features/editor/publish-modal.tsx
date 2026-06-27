"use client";

import { Icon } from "@/components/icons";

// Confirmation dialog shown before publishing an issue. Pulled out of the editor
// to keep that file under the 500-line limit (docs/design-principles.md).
export function PublishModal({
  number,
  onClose,
  onConfirm,
}: {
  number: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card w-[480px] overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="px-8 pt-7">
          <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Publish &amp; send
          </div>
          <h2 className="text-ink mt-3 font-serif text-[27px] leading-tight">
            Publish issue No. {number}?
          </h2>
          <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
            This marks the issue published so members can read it. (Email blasts
            arrive in a later phase.)
          </p>
        </div>
        <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
          <button
            onClick={onClose}
            className="border-hair text-ink flex h-12 items-center rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold"
          >
            Keep as draft
          </button>
          <button
            onClick={onConfirm}
            className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)]"
          >
            <Icon name="check" size={18} strokeWidth={1.8} />
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
