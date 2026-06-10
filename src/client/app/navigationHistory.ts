export type NavigationTarget = {
  folder: string
  noteKey?: string | null
}

export function noteFolderFromRelativePath(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

function normalizeTarget(target: NavigationTarget): NavigationTarget {
  return { folder: target.folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""), noteKey: target.noteKey ?? null }
}

function sameTarget(left: NavigationTarget, right: NavigationTarget): boolean {
  return left.folder === right.folder && (left.noteKey ?? null) === (right.noteKey ?? null)
}

export function createNavigationHistory(initialFolder = "") {
  let current = normalizeTarget({ folder: initialFolder, noteKey: null })
  let backStack: NavigationTarget[] = []
  let forwardStack: NavigationTarget[] = []

  return {
    current() {
      return current
    },
    canBack() {
      return backStack.length > 0
    },
    canForward() {
      return forwardStack.length > 0
    },
    backTarget() {
      return backStack.at(-1) ?? current
    },
    forwardTarget() {
      return forwardStack[0] ?? current
    },
    replaceCurrent(target: NavigationTarget) {
      current = normalizeTarget(target)
      backStack = []
      forwardStack = []
      return current
    },
    push(target: NavigationTarget) {
      const next = normalizeTarget(target)
      if (sameTarget(current, next)) return current
      backStack = [...backStack, current]
      current = next
      forwardStack = []
      return current
    },
    back() {
      const previous = backStack.at(-1)
      if (!previous) return current
      backStack = backStack.slice(0, -1)
      forwardStack = [current, ...forwardStack]
      current = previous
      return current
    },
    forward() {
      const next = forwardStack[0]
      if (!next) return current
      forwardStack = forwardStack.slice(1)
      backStack = [...backStack, current]
      current = next
      return current
    },
  }
}
