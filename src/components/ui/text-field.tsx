"use client";

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[#c0c0c0]">{label}</div>
      <input
        className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-sm text-[#f0f0f0] outline-none placeholder:text-[#505050] focus:border-[#0057ff] transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
      />
    </label>
  );
}

