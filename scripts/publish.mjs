import { $, fs } from 'zx'

await fs.copyFile('README.md', 'packages/kolibri/README.md')
await $`npx pnpm -r publish --access public --no-git-checks`
