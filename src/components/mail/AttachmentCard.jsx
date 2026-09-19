import { FileBarChart, FileSpreadsheet, FileText } from 'lucide-react'
import { mailService } from '../../services/mailService'

const attachmentIcons = { document: FileText, spreadsheet: FileSpreadsheet, report: FileBarChart }

export function AttachmentCard({ attachment, messageId }) {
  const Icon = attachmentIcons[attachment.type] ?? FileText
  return (
    <a className={`attachment ${attachment.tone}`} href={mailService.getAttachmentUrl(messageId, attachment.title)} download={attachment.title} title={`Download ${attachment.title}`}>
      <Icon size={27} />
      <span><b>{attachment.title}</b><span>{attachment.sub}</span><small>{attachment.meta}</small></span>
    </a>
  )
}
