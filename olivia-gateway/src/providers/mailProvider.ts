import type { Folder, MailMessage, MailPage } from '../types/domain.js'

export interface OutgoingAttachment {
  filename: string
  contentType: string
  size: number
  contentBase64: string
}

export interface MailProvider {
  listFolders(): Promise<Folder[]>
  listMessages(folder: string): Promise<MailMessage[]>
  listMessagePage?(folder: string, page: number, pageSize: number): Promise<MailPage>
  getMessage(id: string): Promise<MailMessage | null>
  getAttachment?(id: string, filename: string): Promise<{ filename: string; contentType: string; content: Buffer } | null>
  sendMessage(input: { to: string; cc?: string; bcc?: string; subject: string; body: string; html?: string; attachments?: OutgoingAttachment[] }): Promise<{ id: string; status: string }>
  reply(id: string, input: { body: string; html?: string; attachments?: OutgoingAttachment[] }): Promise<{ id: string; status: string }>
  replyAll(id: string, input: { body: string; html?: string; attachments?: OutgoingAttachment[] }): Promise<{ id: string; status: string }>
  forward(id: string, input: { to: string; cc?: string; bcc?: string; body: string; html?: string; forwardedContentIncluded?: boolean; attachments?: OutgoingAttachment[] }): Promise<{ id: string; status: string }>
  markRead(id: string): Promise<{ id: string; unread: boolean }>
  toggleStar(id: string): Promise<{ id: string; starred: boolean }>
  move(id: string, folder: string): Promise<{ id: string; folder: string }>
  delete(id: string): Promise<{ id: string; deleted: true }>
  listLabels(folder: string): Promise<string[]>
  setMessageLabels(id: string, labels: string[]): Promise<{ id: string; labels: string[] }>
}
