import type { FC } from 'react'
import { useError } from '@/state/conversation'

interface MicPermissionErrorProps {
  onRetry: () => void
}

export const MicPermissionError: FC<MicPermissionErrorProps> = ({ onRetry }) => {
  const error = useError()
  if (error !== 'mic-denied') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-labelledby="mic-error-title"
    >
      <div className="bg-elevated text-default border border-default max-w-md w-full rounded-2xl p-6 shadow-2xl">
        <h2 id="mic-error-title" className="text-xl font-semibold mb-2">
          Microphone access needed
        </h2>
        <p className="text-muted mb-5">
          Boom is voice-only — please grant microphone permission in your browser
          settings, then tap Try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
