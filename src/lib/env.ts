export type Env = {
  baseUrl: string
  apiKey: string
  model: string
}

const REQUIRED_KEYS = [
  'VITE_AI_BASE_URL',
  'VITE_AI_API_KEY',
  'VITE_AI_MODEL',
] as const

function readEnv(): Env {
  const missing: string[] = []
  for (const key of REQUIRED_KEYS) {
    const value = import.meta.env[key]
    if (typeof value !== 'string' || value.length === 0) {
      missing.push(key)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env.local and fill them in.`,
    )
  }
  return {
    baseUrl: import.meta.env.VITE_AI_BASE_URL,
    apiKey: import.meta.env.VITE_AI_API_KEY,
    model: import.meta.env.VITE_AI_MODEL,
  }
}

export const env: Env = readEnv()
