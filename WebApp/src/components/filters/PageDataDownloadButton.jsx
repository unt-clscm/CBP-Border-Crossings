import { Download } from 'lucide-react'
import { downloadCsv } from '@/lib/downloadCsv'

export default function PageDataDownloadButton({ pageDownload }) {
  if (!pageDownload?.data?.length) return null
  const { data, filename, columns } = pageDownload
  return (
    <button
      type="button"
      onClick={() => downloadCsv(data, filename, columns)}
      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-base font-medium
                 text-brand-blue border border-brand-blue/30 rounded-lg
                 hover:bg-brand-blue/5 transition-all duration-150"
    >
      <Download size={14} />
      Download Page Data (CSV)
    </button>
  )
}
