import type { Folder, MailMessage } from '../types/domain.js'

export interface MailProvider {
  listFolders(): Promise<Folder[]>
  listMessages(folder: string): Promise<MailMessage[]>
  getMessage(id: string): Promise<MailMessage | null>
  sendMessage(input: { to: string; subject: string; body: string }): Promise<{ id: string; status: string }>
  reply(id: string, input: { body: string }): Promise<{ id: string; status: string }>
  forward(id: string, input: { to: string; body: string }): Promise<{ id: string; status: string }>
  markRead(id: string): Promise<{ id: string; unread: boolean }>
  toggleStar(id: string): Promise<{ id: string; starred: boolean }>
  move(id: string, folder: string): Promise<{ id: string; folder: string }>
  delete(id: string): Promise<{ id: string; deleted: true }>
}
