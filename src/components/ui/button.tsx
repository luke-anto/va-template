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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
        variant === "primary" && "bg-[#0057ff] text-white hover:bg-[#1a6aff] shadow-[0_0_16px_rgba(0,87,255,0.28)] hover:shadow-[0_0_22px_rgba(0,87,255,0.42)] disabled:bg-[#0a1a3d] disabled:text-[#3a5080] disabled:shadow-none",
        variant === "secondary" && "bg-[#1a1a1a] text-[#d0d0d0] border border-[#333] hover:bg-[#222] hover:text-[#f0f0f0] hover:border-[#444] disabled:text-[#454545] disabled:border-[#252525]",
        "disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

