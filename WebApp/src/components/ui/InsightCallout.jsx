import { Lightbulb } from 'lucide-react'

const VARIANTS = {
  default: {
    border: 'border-brand-blue',
    iconBg: 'bg-brand-blue/10',
    iconColor: 'text-brand-blue',
  },
  highlight: {
    border: 'border-brand-green',
    iconBg: 'bg-brand-green/10',
    iconColor: 'text-brand-green',
  },
  warning: {
    border: 'border-brand-orange',
    iconBg: 'bg-brand-orange/10',
    iconColor: 'text-brand-orange',
  },
  texas: {
    border: 'border-[#bf5700]',
    iconBg: 'bg-[#bf5700]/10',
    iconColor: 'text-[#bf5700]',
  },
}

export default function InsightCallout({
  finding,
  context,
  icon: Icon = Lightbulb, // eslint-disable-line no-unused-vars
  variant = 'default',
  className = '',
}) {
  const v = VARIANTS[variant] || VARIANTS.default

  return (
    <div className={`flex gap-4 border-l-[3px] pl-4 py-2 rounded-r-lg transition-all duration-300 hover:bg-surface-alt/50 hover:shadow-sm ${v.border} ${className}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${v.iconBg} flex items-center justify-center mt-0.5`}>
        <Icon size={18} className={v.iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-text-primary leading-snug">{finding}</p>
        {context && (
          <p className="text-base text-text-secondary italic mt-1 leading-relaxed">{context}</p>
        )}
      </div>
    </div>
  )
}
