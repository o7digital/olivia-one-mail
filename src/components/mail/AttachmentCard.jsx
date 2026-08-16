import { FileBarChart, FileSpreadsheet, FileText } from 'lucide-react'

const attachmentIcons = { document: FileText, spreadsheet: FileSpreadsheet, report: FileBarChart }

export function AttachmentCard({ attachment }) {
  const Icon = attachmentIcons[attachment.type] ?? FileText
  return (
    <button className={`attachment ${attachment.tone}`} type="button" title={`Preview ${attachment.title}`}>
      <Icon size={27} />
      <span><b>{attachment.title}</b><span>{attachment.sub}</span><small>{attachment.meta}</small></span>
    </button>
  )
}
