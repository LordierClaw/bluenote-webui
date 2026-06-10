import { render } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { MarkdownPreview } from "../src/client/components/MarkdownPreview"

describe("markdown preview regressions", () => {
  test("preview stays renderable for an incomplete heading marker", () => {
    const { container } = render(<MarkdownPreview body="# " />)
    expect(container.querySelector(".markdown-preview")).toBeInTheDocument()
  })
})
