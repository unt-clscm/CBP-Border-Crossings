import { MapPin } from 'lucide-react'

export default function MapPlaceholder({ title = 'Interactive Map', height = 400 }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-border bg-surface-alt/50
                 flex flex-col items-center justify-center gap-3 text-text-secondary"
      style={{ minHeight: height }}
    >
      <div className="p-3 rounded-full bg-brand-blue/5">
        <MapPin size={28} className="text-brand-blue/40" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-text-primary/60">{title}</p>
        <p className="text-base text-text-secondary/60 mt-1">
          Geospatial visualization will be added<br />when GIS data is available
        </p>
      </div>
    </div>
  )
}
