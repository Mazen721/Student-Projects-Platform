const TONE_CLASSES = {
  success: 'bg-[#dcfce7] text-[#15803d]',
  warning: 'bg-[#fef3c7] text-[#b45309]',
  danger: 'bg-[#fee2e2] text-[#b91c1c]',
  info: 'bg-[#e7edf3] text-navy',
  featured: 'bg-[#faf3d7] text-[#7c5e0b]',
};

export function Badge({ tone = 'info', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-extrabold ${TONE_CLASSES[tone] || TONE_CLASSES.info} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
