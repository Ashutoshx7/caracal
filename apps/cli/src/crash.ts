// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Process-level safety net: installs uncaughtException / unhandledRejection handlers that print a single clean line and exit, preventing partial state and noisy stack traces in production.

import { printError } from './style.ts'

let installed = false

export function installCrashHandlers(label: string): void {
  if (installed) return
  installed = true
  process.on('uncaughtException', (err) => {
    printError(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    printError(`${label}: ${reason instanceof Error ? reason.message : String(reason)}`)
    process.exit(1)
  })
}
