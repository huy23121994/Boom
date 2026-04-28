import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  shortcuts: {
    'text-default': 'text-gray-900 dark:text-gray-100',
    'text-muted': 'text-gray-500 dark:text-gray-400',
    'bg-default': 'bg-white dark:bg-gray-950',
    'bg-elevated': 'bg-gray-50 dark:bg-gray-900',
    'border-default': 'border-gray-200 dark:border-gray-800',
  },
})
