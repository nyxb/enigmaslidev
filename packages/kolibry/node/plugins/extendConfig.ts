import { dirname, join } from 'node:path'
import type { InlineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'
import isInstalledGlobally from 'is-installed-globally'
import { uniq } from '@nyxb/utils'
import { getIndexHtml } from '../common'
import { dependencies } from '../../../client/package.json'
import type { ResolvedKolibryOptions } from '../options'
import { resolveGlobalImportPath, resolveImportPath, toAtFS } from '../utils'
import { searchForWorkspaceRoot } from '../vite/searchRoot'

const EXCLUDE = [
  '@kolibry/shared',
  '@kolibry/types',
  '@kolibry/client',
  '@kolibry/client/constants',
  '@kolibry/client/logic/dark',
  '@vueuse/core',
  '@vueuse/shared',
  '@unocss/reset',
  'unocss',
  'mermaid',
  'vite-plugin-windicss',
  'vue-demi',
  'vue',
]

export function createConfigPlugin(options: ResolvedKolibryOptions): Plugin {
  return {
    name: 'kolibry:config',
    async config(config) {
      const injection: InlineConfig = {
        define: getDefine(options),
        resolve: {
          alias: {
            '@kolibry/client/': `${toAtFS(options.clientRoot)}/`,
          },
          dedupe: ['vue'],
        },
        optimizeDeps: {
          include: [
            ...Object.keys(dependencies).filter(i => !EXCLUDE.includes(i)),
            'codemirror/mode/javascript/javascript',
            'codemirror/mode/css/css',
            'codemirror/mode/markdown/markdown',
            'codemirror/mode/xml/xml',
            'codemirror/mode/htmlmixed/htmlmixed',
            'codemirror/addon/display/placeholder',
            'prettier/plugins/babel',
            'prettier/plugins/html',
            'prettier/plugins/typescript',
            'mermaid/dist/mermaid.esm.min.mjs',
            'mermaid/dist/mermaid.esm.mjs',
            'vite-plugin-vue-server-ref/client',
          ],
          exclude: EXCLUDE,
        },
        css: options.data.config.css === 'unocss'
          ? {
              postcss: {
                plugins: [
                  await import('postcss-nested').then(r => (r.default || r)()) as any,
                ],
              },
            }
          : {},
        server: {
          fs: {
            strict: true,
            allow: uniq([
              searchForWorkspaceRoot(options.userRoot),
              searchForWorkspaceRoot(options.cliRoot),
              ...(
                isInstalledGlobally
                  ? [dirname(resolveGlobalImportPath('@kolibry/client/package.json')), dirname(resolveGlobalImportPath('katex/package.json'))]
                  : []
              ),
            ]),
          },
        },
        publicDir: join(options.userRoot, 'public'),
      }

      if (isInstalledGlobally) {
        injection.cacheDir = join(options.cliRoot, 'node_modules/.vite')
        injection.root = options.cliRoot
        // @ts-expect-error type cast
        injection.resolve.alias.vue = `${resolveImportPath('vue/dist/vue.esm-browser.js', true)}`
      }

      return mergeConfig(injection, config)
    },
    configureServer(server) {
      // serve our index.html after vite history fallback
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url!.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html')
            res.statusCode = 200
            res.end(await getIndexHtml(options))
            return
          }
          next()
        })
      }
    },
  }
}

export function getDefine(options: ResolvedKolibryOptions): Record<string, string> {
  return {
    __DEV__: options.mode === 'dev' ? 'true' : 'false',
    __KOLIBRI_CLIENT_ROOT__: JSON.stringify(toAtFS(options.clientRoot)),
    __KOLIBRI_HASH_ROUTE__: JSON.stringify(options.data.config.routerMode === 'hash'),
    __KOLIBRI_FEATURE_DRAWINGS__: JSON.stringify(options.data.config.drawings.enabled === true || options.data.config.drawings.enabled === options.mode),
    __KOLIBRI_FEATURE_EDITOR__: JSON.stringify(options.mode === 'dev' && options.data.config.editor !== false),
    __KOLIBRI_FEATURE_DRAWINGS_PERSIST__: JSON.stringify(!!options.data.config.drawings.persist === true),
    __KOLIBRI_FEATURE_RECORD__: JSON.stringify(options.data.config.record === true || options.data.config.record === options.mode),
    __KOLIBRI_FEATURE_PRESENTER__: JSON.stringify(options.data.config.presenter === true || options.data.config.presenter === options.mode),
    __KOLIBRI_HAS_SERVER__: options.mode !== 'build' ? 'true' : 'false',
  }
}
