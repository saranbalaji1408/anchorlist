import { VERSION } from '@anchorlist/react'

export function App() {
  return (
    <main>
      <h1>anchorlist fixture</h1>
      <p data-testid="version">{VERSION}</p>
    </main>
  )
}
