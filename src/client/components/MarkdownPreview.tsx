import type { ReactNode } from "react"

export function MarkdownPreview({ body }: { body?: string }) {
  const source = body?.trim() ? body : "Empty note"
  return <div className="markdown-preview">{renderBlocks(source)}</div>
}

type InlineToken = {
  start: number
  end: number
  type: "code" | "bold" | "italic" | "link"
  text: string
  href?: string
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === "") {
      index += 1
      continue
    }

    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(<pre key={blocks.length}><code>{codeLines.join("\n")}</code></pre>)
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const content = renderInline(heading[2], `${blocks.length}-h`)
      if (level === 1) blocks.push(<h1 key={blocks.length}>{content}</h1>)
      if (level === 2) blocks.push(<h2 key={blocks.length}>{content}</h2>)
      if (level === 3) blocks.push(<h3 key={blocks.length}>{content}</h3>)
      index += 1
      continue
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""))
        index += 1
      }
      blocks.push(<ul key={blocks.length}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${blocks.length}-li-${itemIndex}`)}</li>)}</ul>)
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""))
        index += 1
      }
      blocks.push(<blockquote key={blocks.length}>{renderBlocks(quoteLines.join("\n"))}</blockquote>)
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index])
      index += 1
    }
    blocks.push(<p key={blocks.length}>{renderInline(paragraphLines.join(" "), `${blocks.length}-p`)}</p>)
  }

  return blocks
}

function isBlockStart(line: string) {
  return /^```/.test(line) || /^(#{1,3})\s+/.test(line) || /^\s*-\s+/.test(line) || /^>\s?/.test(line)
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0

  while (cursor < text.length) {
    const token = nextInlineToken(text, cursor)
    if (!token) {
      nodes.push(text.slice(cursor))
      break
    }

    if (token.start > cursor) nodes.push(text.slice(cursor, token.start))

    const key = `${keyPrefix}-${nodes.length}`
    if (token.type === "code") {
      nodes.push(<code key={key}>{token.text}</code>)
    } else if (token.type === "bold") {
      nodes.push(<strong key={key}>{renderInline(token.text, `${key}-bold`)}</strong>)
    } else if (token.type === "italic") {
      nodes.push(<em key={key}>{renderInline(token.text, `${key}-italic`)}</em>)
    } else if (token.href && isSafeHref(token.href)) {
      nodes.push(<a key={key} href={token.href}>{renderInline(token.text, `${key}-link`)}</a>)
    } else {
      nodes.push(...renderInline(token.text, `${key}-unsafe-link`))
    }

    cursor = token.end
  }

  return nodes
}

function nextInlineToken(text: string, from: number): InlineToken | null {
  const candidates: InlineToken[] = []

  const codeStart = text.indexOf("`", from)
  if (codeStart >= 0) {
    const codeEnd = text.indexOf("`", codeStart + 1)
    if (codeEnd > codeStart) candidates.push({ start: codeStart, end: codeEnd + 1, type: "code", text: text.slice(codeStart + 1, codeEnd) })
  }

  const boldStart = text.indexOf("**", from)
  if (boldStart >= 0) {
    const boldEnd = text.indexOf("**", boldStart + 2)
    if (boldEnd > boldStart) candidates.push({ start: boldStart, end: boldEnd + 2, type: "bold", text: text.slice(boldStart + 2, boldEnd) })
  }

  const linkStart = text.indexOf("[", from)
  if (linkStart >= 0) {
    const labelEnd = text.indexOf("](", linkStart + 1)
    if (labelEnd > linkStart) {
      const hrefStart = labelEnd + 2
      const hrefEnd = text.indexOf(")", hrefStart)
      if (hrefEnd > hrefStart) {
        candidates.push({ start: linkStart, end: hrefEnd + 1, type: "link", text: text.slice(linkStart + 1, labelEnd), href: text.slice(hrefStart, hrefEnd).trim() })
      }
    }
  }

  for (const marker of ["*", "_"]) {
    const italicStart = text.indexOf(marker, from)
    if (italicStart >= 0 && text[italicStart + 1] !== marker && text[italicStart - 1] !== marker) {
      const italicEnd = text.indexOf(marker, italicStart + 1)
      if (italicEnd > italicStart && text[italicEnd + 1] !== marker && text[italicEnd - 1] !== marker) {
        candidates.push({ start: italicStart, end: italicEnd + 1, type: "italic", text: text.slice(italicStart + 1, italicEnd) })
      }
    }
  }

  if (!candidates.length) return null
  return candidates.sort((a, b) => a.start - b.start || a.end - b.end)[0]
}

function isSafeHref(href: string) {
  return /^(https?:|mailto:|#|\/(?!\/))/i.test(href.trim())
}
