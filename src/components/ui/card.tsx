import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200", className)}>{children}</section>;
}

