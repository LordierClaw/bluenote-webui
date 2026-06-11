#!/usr/bin/env node
/* global process */

import { runWebCommand } from "../dist/src/command.js"

const result = await runWebCommand(process.argv.slice(2))
if (typeof result === "number") {
  process.exitCode = result
}
