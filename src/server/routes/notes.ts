import type { CreateNoteRequest, UpdateNoteRequest } from "../../shared/types.js"
import type { Router } from "../services/http.js"
import { archiveNote, createNote, deleteNote, getNote, listNotes, promoteDraft, rebuildWorkspace, updateNote } from "../services/note-service.js"

function routeSelector(params: Record<string, string>): string {
  return params.id ?? ""
}

export function registerNoteRoutes(router: Router): void {
  router.get("/api/notes", ({ url }) => listNotes({ folder: url.searchParams.get("folder"), query: url.searchParams.get("query") }))
  router.get("/api/notes/:id", ({ params }) => getNote(routeSelector(params)))
  router.post("/api/notes", ({ body }) => createNote((body ?? {}) as CreateNoteRequest))
  router.patch("/api/notes/:id", ({ params, body }) => updateNote(routeSelector(params), (body ?? {}) as UpdateNoteRequest))
  router.delete("/api/notes/:id", ({ params }) => deleteNote(routeSelector(params)))
  router.post("/api/notes/:id/archive", ({ params }) => archiveNote(routeSelector(params)))
  router.post("/api/notes/:id/promote", ({ params, body }) => {
    const request = (body ?? {}) as { title?: string; destinationFolder?: string }
    return promoteDraft(routeSelector(params), request.title ?? "", request.destinationFolder)
  })
  router.post("/api/rebuild", () => rebuildWorkspace())
}
