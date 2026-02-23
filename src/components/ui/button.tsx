"use client";

import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
        variant === "primary" && "bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-400",
        variant === "secondary" && "bg-white text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:text-zinc-400",
        "disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

