import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  shortcuts: {
    'text-default': 'text-[var(--text-primary)]',
    'text-muted': 'text-[var(--text-secondary)]',
    'bg-default': 'bg-[var(--bg-primary)]',
    'bg-elevated': 'bg-[var(--bg-elevated)]',
    'border-default': 'border-[var(--border-color)]',
  },
})
