import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// TypeScript in components is stripped when packaging, so `dist` ships plain JavaScript.
export default { preprocess: vitePreprocess({ script: true }) }
