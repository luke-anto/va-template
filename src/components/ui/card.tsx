import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "rounded-xl p-5",
        "bg-[#111111] border border-[#252525]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
        className
      )}
    >
      {children}
    </section>
  );
}

