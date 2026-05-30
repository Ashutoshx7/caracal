// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Third-party research agent that calls an OpenAI-compatible API using a runtime-injected key.

// `caracal run` injects credentials and a strict env allowlist; arbitrary config
// env vars are not forwarded. Non-secret config is therefore taken from argv flags
// (which pass through cleanly), then env, then a sane default.
function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (const tok of argv) {
    const m = /^--([a-zA-Z-]+)=(.*)$/.exec(tok)
    if (m) flags[m[1]] = m[2]
    else rest.push(tok)
  }
  return { flags, task: rest.join(' ') }
}

const { flags, task } = parseArgs(process.argv.slice(2))
const BASE_URL = flags['base-url'] ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const MODEL = flags['model'] ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

// The agent never reads a secret file or .env. The key is whatever the launcher
// placed in the environment for the lifetime of this process.
const API_KEY = process.env.OPENAI_API_KEY
if (!API_KEY) {
  process.stderr.write('OPENAI_API_KEY is not set; launch through `caracal run`\n')
  process.exit(2)
}

async function chat(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`openai_call_failed status=${res.status} body=${detail}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

async function main() {
  const goal = task || 'Summarize the benefits of short-lived credentials.'

  const plan = await chat([
    { role: 'system', content: 'You are a research planner. Reply with one short step.' },
    { role: 'user', content: `Task: ${goal}` },
  ])

  const answer = await chat([
    { role: 'system', content: 'You are a research writer. Produce a concise final answer.' },
    { role: 'user', content: `Task: ${goal}\nPlan: ${plan}` },
  ])

  process.stdout.write(JSON.stringify({ task: goal, plan, answer }) + '\n')
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
