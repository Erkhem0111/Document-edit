type AuthFieldProps = {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthField({ label, icon, children }: AuthFieldProps) {
  return (
    <label className="block text-sm font-medium text-[#101b22]">
      <span className="mb-2 block">{label}</span>
      <span className="relative block [&_svg]:pointer-events-none [&_svg]:absolute [&_svg]:left-3 [&_svg]:top-1/2 [&_svg]:size-4 [&_svg]:-translate-y-1/2 [&_svg]:text-[#8b7a55]">
        {icon}
        {children}
      </span>
    </label>
  );
}
