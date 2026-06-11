import { act, useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { useAutosave } from "../src/client/app/useAutosave"

describe("autosave regressions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("autosave resets its delay from the most recent edit instead of the first dirty change", async () => {
    const saves: string[] = []

    function Harness() {
      const [body, setBody] = useState("")
      const dirty = body.length > 0
      useAutosave(true, dirty, async () => {
        saves.push(body)
      }, 1200)
      return (
        <div>
          <button onClick={() => setBody("a")}>first</button>
          <button onClick={() => setBody("ab")}>second</button>
          <span>{body}</span>
        </div>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "first" }))

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    fireEvent.click(screen.getByRole("button", { name: "second" }))

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(saves).toEqual([])

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(saves).toEqual(["ab"])
  })
})
