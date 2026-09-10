import { useMemo } from 'react'

export function EmailBody({ html, subject }) {
  const documentHtml = useMemo(() => {
    const document = new DOMParser().parseFromString(html, 'text/html')
    document.querySelectorAll('base').forEach((element) => element.remove())
    document.querySelectorAll('a[href], area[href]').forEach((link) => {
      const href = link.getAttribute('href').trim()
      if (href.startsWith('#')) return
      try {
        const url = new URL(href)
        if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error('Unsupported link')
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
      } catch {
        link.removeAttribute('href')
      }
    })
    return '<!doctype html>' + document.documentElement.outerHTML
  }, [html])

  return <iframe className="messageHtml" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={documentHtml} title={`Email content: ${subject}`} />
}
