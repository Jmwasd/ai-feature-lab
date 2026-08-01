import { loadBenchScene, runBench } from './bench'

/**
 * 개발 빌드에서만 콘솔·자동화가 벤치마크를 부를 수 있게 열어둔다.
 *
 * `main.tsx`가 `import.meta.env.DEV` 안에서 동적 import로 부르므로
 * 프로덕션 번들에는 이 파일도, `seed.ts`·`bench.ts`도 들어가지 않는다.
 */
declare global {
  interface Window {
    __bench?: { run: typeof runBench; load: typeof loadBenchScene }
  }
}

window.__bench = { run: runBench, load: loadBenchScene }
