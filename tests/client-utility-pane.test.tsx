import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { UtilityPane } from "../src/client/components/UtilityPane"

describe("utility pane", () => {
  test("keeps markdown preview as the dedicated primary surface", () => {
    render(
      <UtilityPane
        preview={<div>Rendered markdown</div>}
        details={<div>Note metadata</div>}
        footer={<button type="button">Open AI tools</button>}
      />,
    )

    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/markdown preview pane/i)).toBeInTheDocument()
    expect(screen.getByText(/rendered markdown/i)).toBeInTheDocument()
    expect(screen.getByText(/note metadata/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /open ai tools/i })).toBeInTheDocument()
  })

  test("can render only the preview when no extra utility sections are supplied", () => {
    render(
      <UtilityPane
        preview={<div>Rendered markdown</div>}
      />,
    )

    expect(screen.getByText(/rendered markdown/i)).toBeInTheDocument()
    expect(screen.queryByText(/note metadata/i)).not.toBeInTheDocument()
  })
})
