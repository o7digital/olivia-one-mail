import { BrainCircuit, CalendarDays, CheckSquare2, Mail, Search, X } from 'lucide-react'

const icons = { email: Mail, task: CheckSquare2, calendar: CalendarDays }

export function AskOliviaDialog({ query, result, status, onClose, onOpenSource }) {
  return <div className="modalBackdrop" role="presentation"><section className="modal askDialog" role="dialog" aria-modal="true" aria-labelledby="ask-title">
    <header><div><small>Global work search</small><h2 id="ask-title"><BrainCircuit size={20} />Ask Olivia</h2></div><button type="button" onClick={onClose} aria-label="Close Ask Olivia"><X size={18} /></button></header>
    <div className="askQuery"><Search size={16} /><span>{query}</span></div>
    {status === 'loading' ? <div className="aiTabContent"><BrainCircuit size={24} /><b>Searching connected work…</b><p>Olivia is checking only the data available to this mailbox.</p></div> : null}
    {status === 'error' ? <div className="aiTabContent"><b>Ask Olivia is temporarily unavailable.</b><p>No answer or source was fabricated.</p></div> : null}
    {result ? <><div className="askAnswer">{result.answer}</div><div className="askSources">{result.sources.map((source) => { const Icon = icons[source.type] || Mail; return <button type="button" key={`${source.type}:${source.messageId || source.taskId}`} onClick={() => onOpenSource(source)}><Icon size={16} /><span><b>{source.title}</b><small>{source.type} · {source.date || 'No date'}</small></span></button> })}</div><p className="askCoverage">Unavailable sources are excluded: {Object.entries(result.coverage).filter(([, available]) => !available).map(([name]) => name).join(', ') || 'none'}.</p></> : null}
  </section></div>
}
