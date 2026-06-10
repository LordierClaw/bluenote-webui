import type { CreateNoteRequest, UpdateNoteRequest } from "../../shared/types.js"
import type { Router } from "../services/http.js"
import { archiveNote, createFolder, createNote, deleteNote, getNote, getStartupNote, listFolders, listNotes, moveNote, promoteDraft, rebuildWorkspace, renameFolder, updateNote } from "../services/note-service.js"

function routeSelector(params: Record<string, string>): string {
  return params.id ?? ""
}

export function registerNoteRoutes(router: Router): void {
  router.get("/api/folders", () => listFolders())
  router.post("/api/folders", ({ body }) => createFolder((body as { relativePath?: unknown } | undefined)?.relativePath))
  router.patch("/api/folders/rename", ({ body }) => {
    const request = (body ?? {}) as { relativePath?: unknown; nextName?: unknown }
    return renameFolder(request.relativePath, request.nextName)
  })
  router.get("/api/notes/startup", () => getStartupNote())
  router.get("/api/notes", ({ url }) => listNotes({ folder: url.searchParams.get("folder"), query: url.searchParams.get("query") }))
  router.get("/api/notes/:id", ({ params }) => getNote(routeSelector(params)))
  router.post("/api/notes", ({ body }) => createNote((body ?? {}) as CreateNoteRequest))
  router.patch("/api/notes/:id", ({ params, body }) => updateNote(routeSelector(params), (body ?? {}) as UpdateNoteRequest))
  router.delete("/api/notes/:id", ({ params }) => deleteNote(routeSelector(params)))
  router.post("/api/notes/:id/archive", ({ params }) => archiveNote(routeSelector(params)))
  router.post("/api/notes/:id/move", ({ params, body }) => moveNote(routeSelector(params), (body as { destinationFolder?: unknown } | undefined)?.destinationFolder))
  router.post("/api/notes/:id/promote", ({ params, body }) => {
    const request = (body ?? {}) as { title?: string; destinationFolder?: string }
    return promoteDraft(routeSelector(params), request.title ?? "", request.destinationFolder)
  })
  router.post("/api/rebuild", () => rebuildWorkspace())
}
