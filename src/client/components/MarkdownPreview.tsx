import type { AnchorHTMLAttributes, ReactNode } from "react"

import ReactMarkdown from "react-markdown"

function isSafeHref(href: string | undefined): href is string {
  if (!href) return false
  const trimmed = href.trim()
  if (trimmed.length === 0 || trimmed.startsWith("//")) return false
  if (trimmed.startsWith("/")) return true
  if (/^(https?:|mailto:)/iu.test(trimmed)) return true
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return false
  return true
}

function SafeLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  if (!isSafeHref(href)) {
    return <>{children}</>
  }
  return <a {...props} href={href}>{children}</a>
}

export function MarkdownPreview({ body }: { body: string }) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown components={{ a: SafeLink }}>{body}</ReactMarkdown>
    </div>
  )
}
