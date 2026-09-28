import { Suspense, lazy } from 'react'

const DungeonSurvival = lazy(() => import('./components/DungeonSurvival.jsx'))

const PORTFOLIO_URL = 'https://aliimranrohaizi.xyz'

function App() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <header className="mb-8 max-w-xl text-center">
        <h1 className="text-lg leading-relaxed text-[#e8e4f5] sm:text-2xl" style={{ fontFamily: 'var(--font-pixel)' }}>
          Dungeon Survival
        </h1>
        <p className="mt-4 text-sm text-[#8b83a3]">
          Dash, strike, and hold off waves of shades and bosses in this top-down survival arena.
        </p>
      </header>

      <main className="w-full">
        <Suspense fallback={<div className="mx-auto aspect-video max-w-[960px]" aria-hidden="true" />}>
          <DungeonSurvival projectsHref={`${PORTFOLIO_URL}/#work`} />
        </Suspense>
      </main>

      <footer className="mt-10 flex flex-col items-center gap-1 text-xs text-[#8b83a3]">
        <p>
          A game by{' '}
          <a className="text-[#a78bfa] hover:underline" href={PORTFOLIO_URL}>
            Ali Imran
          </a>
          , spun off from his portfolio.
        </p>
        <a className="text-[#a78bfa] hover:underline" href="https://github.com/Ali-Imran01/dungeon-survival">
          View source on GitHub
        </a>
      </footer>
    </div>
  )
}

export default App
