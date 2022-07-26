import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'

const set = <T extends unknown>(arr: T[], idx: number, t: T | ((t: T) => T)) =>
  arr.map((e, i) => (i === idx ? (typeof t === 'function' ? (t as (t: T) => T)(e) : t) : e))

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Pos = [x: number, y: number]
type PosStr = `${number}:${number}`
const pos = ([x, y]: Pos): PosStr => `${x}:${y}`

enum Tile {
  Empty = 'Empty',
  Visited = 'Visited',
  Wall = 'Wall',
  Player = 'Player',
  Goal = 'Goal',
  Path = 'Path',
  ReachedGoal = 'ReachedGoal',
}

type Item = 'Unset' | 'Holding' | ['Set', Pos]

const colors: Record<Tile, string> = {
  Empty: '#eee',
  Visited: '#66d',
  Wall: '#333',
  Player: '#f00',
  Goal: '#0f0',
  Path: '#00f',
  ReachedGoal: '#f0f',
}

const shuffle = <T extends unknown>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)

const neighbors = ([x, y]: Pos): Pos[] =>
  shuffle([
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ])

const [state, setState] = createStore({ width: 16, height: 16, tiles: [] as Tile[][] })

const [width, setWidth] = createSignal(16)
const [height, setHeight] = createSignal(16)

const [isRunning, setRunning] = createSignal(false)
const [visited, setVisited] = createSignal(new Set<PosStr>())
const [steps, setSteps] = createSignal<Pos[]>([])

const visit = (p: Pos) => {
  if (visited().has(pos(p))) return
  setVisited(v => v.add(pos(p)))
  if (getTile(p) !== Tile.Goal) setTile(p, Tile.Visited)
}

const step = (p: Pos) => {
  setSteps(s => [...s, p])
  if (getTile(p) !== Tile.Goal) setTile(p, Tile.Path)
}

const [player, setPlayer] = createSignal<Item>('Unset')
const [goal, setGoal] = createSignal<Item>('Unset')
const [isUsingGrid, setUsingGrid] = createSignal(false)
const [fps, setFps] = createSignal(100)

const emptyTiles = () => new Array(height()).fill(new Array(width()).fill(Tile.Empty)) as Tile[][]
const getTile = ([x, y]: Pos) => state.tiles[y]?.[x] ?? Tile.Wall
const setTile = ([x, y]: Pos, t: Tile) => setState('tiles', g => set(g, y, l => set(l, x, t)))

const resetGrid = () => {
  setState({ width: width(), height: height(), tiles: emptyTiles() })
  setUsingGrid(false)
  if (player()[0] === 'Set') setTile((player() as ['Set', Pos])[1], Tile.Player)
  if (goal()[0] === 'Set') setTile((goal() as ['Set', Pos])[1], Tile.Goal)
}

const allowed = (p: Pos): boolean => getTile(p) !== Tile.Wall && getTile(p) !== Tile.Player

const findPath = async (start: Pos): Promise<boolean> => {
  setVisited(new Set<PosStr>())
  setSteps([])

  const findPathHelp = async (start: Pos): Promise<boolean> => {
    if (getTile(start) === Tile.Goal) return true
    const moves = neighbors(start).filter(p => allowed(p) && !visited().has(pos(p)))

    await sleep(1000 / fps())
    for (const p of moves) visit(p)

    for (const p of moves) {
      if (await findPathHelp(p)) {
        await sleep(1000 / fps())
        step(p)
        return true
      }
    }

    return false
  }

  return findPathHelp(start)
}

const App: Component = () => {
  resetGrid()

  let gridRef: HTMLDivElement | null = null

  const handleMouse = (e: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => {
    e.preventDefault()
    if (player() === 'Holding' || goal() === 'Holding') return

    const { top, left, width, height } = e.currentTarget.getBoundingClientRect()
    const { clientX: cx, clientY: cy } = e

    if (cx < left || cx > left + width || cy < top || cy > top + height) return

    const y = Math.floor((cy - top) / (height / state.height))
    const x = Math.floor((cx - left) / (width / state.width))

    const tile = getTile([x, y])

    if (tile !== Tile.Player && tile !== Tile.Goal) {
      if (e.buttons === 1) setTile([x, y], Tile.Wall)
      if (e.buttons === 2) setTile([x, y], Tile.Empty)
    }
  }

  return (
    <div
      style={{
        'display': 'flex',
        'flex-direction': 'column',
        'justify-content': 'space-around',
        'align-items': 'center',
        'width': '100%',
        'height': '100%',
        'background-color': '#282c34',
        'color': '#fff',
        'user-select': 'none',
      }}
    >
      <div>
        <div>
          <label>
            Width:{' '}
            <input
              type="number"
              value={width()}
              onInput={e => {
                const w = parseInt(e.currentTarget.value, 10)
                if (!isNaN(w)) setWidth(w)
              }}
            />
          </label>
          <label>
            Height:{' '}
            <input
              type="number"
              value={height()}
              onInput={e => {
                const h = parseInt(e.currentTarget.value, 10)
                if (!isNaN(h)) setHeight(h)
              }}
            />
          </label>
        </div>
        <div>
          <label>
            Steps per Second:{' '}
            <input
              type="number"
              value={fps()}
              onInput={e => {
                const sps = parseInt(e.currentTarget.value, 10)
                if (!isNaN(sps)) setFps(sps)
              }}
            />
          </label>
        </div>
        <div>
          <button onClick={resetGrid} disabled={isRunning()}>
            Reset grid
          </button>
          <button
            onClick={async () => {
              if (player()?.[0] !== 'Set' || goal()?.[0] !== 'Set') return
              resetGrid()
              setRunning(true)
              setUsingGrid(true)
              await findPath((player() as ['Set', Pos])[1])
              setRunning(false)
              setUsingGrid(false)

              if (steps().length === 0) return
            }}
            disabled={isRunning() || player()[0] !== 'Set' || goal()[0] !== 'Set' || isUsingGrid()}
          >
            Run
          </button>
        </div>
      </div>
      <div style={{ height: '32px', display: 'flex', gap: '32px' }}>
        <Show
          when={player()?.[0] !== 'Set'}
          fallback={
            <button
              onClick={() => {
                setTile((player() as ['Set', Pos])[1], Tile.Empty)
                setPlayer('Unset')
              }}
            >
              Reset Player
            </button>
          }
        >
          <div
            onMouseDown={e => {
              setPlayer('Holding')

              const player = e.currentTarget

              const dragPlayer = (e: MouseEvent) => {
                player.style.position = 'absolute'
                player.style.left = `${e.clientX - player.clientWidth / 2}px`
                player.style.top = `${e.clientY - player.clientHeight / 2}px`
              }

              dragPlayer(e)

              document.addEventListener('mousemove', dragPlayer)
              document.addEventListener(
                'mouseup',
                e => {
                  document.removeEventListener('mousemove', dragPlayer)

                  player.style.position = 'static'
                  player.style.left = '0'
                  player.style.top = '0'

                  const { top, left, width, height } = gridRef!.getBoundingClientRect()
                  const { clientX: cx, clientY: cy } = e

                  if (cx < left || cx > left + width || cy < top || cy > top + height) return

                  const y = Math.floor((cy - top) / (height / state.height))
                  const x = Math.floor((cx - left) / (width / state.width))

                  setTile([x, y], Tile.Player)
                  setPlayer(['Set', [x, y]])
                },
                { once: true },
              )
            }}
          >
            <div
              style={{
                'width': `calc(75vh / ${state.width})`,
                'height': `calc(75vh / ${state.height})`,
                'background-color': colors[Tile.Player],
                'border-radius': '50%',
              }}
            />
          </div>
        </Show>
        <Show
          when={goal()?.[0] !== 'Set'}
          fallback={
            <button
              onClick={() => {
                setTile((goal() as ['Set', Pos])[1], Tile.Empty)
                setGoal('Unset')
              }}
            >
              Reset Goal
            </button>
          }
        >
          <div
            onMouseDown={e => {
              setGoal('Holding')

              const goal = e.currentTarget

              const dragGoal = (e: MouseEvent) => {
                goal.style.position = 'absolute'
                goal.style.left = `${e.clientX - goal.clientWidth / 2}px`
                goal.style.top = `${e.clientY - goal.clientHeight / 2}px`
              }

              dragGoal(e)

              document.addEventListener('mousemove', dragGoal)
              document.addEventListener(
                'mouseup',
                e => {
                  document.removeEventListener('mousemove', dragGoal)

                  goal.style.position = 'static'
                  goal.style.left = '0'
                  goal.style.top = '0'

                  const { top, left, width, height } = gridRef!.getBoundingClientRect()
                  const { clientX: cx, clientY: cy } = e

                  if (cx < left || cx > left + width || cy < top || cy > top + height) return

                  const y = Math.floor((cy - top) / (height / state.height))
                  const x = Math.floor((cx - left) / (width / state.width))

                  setTile([x, y], Tile.Goal)
                  setGoal(['Set', [x, y]])
                },
                { once: true },
              )
            }}
          >
            <div
              style={{
                'width': `calc(75vh / ${state.width})`,
                'height': `calc(75vh / ${state.height})`,
                'background-color': colors[Tile.Goal],
                'border-radius': '50%',
              }}
            />
          </div>
        </Show>
      </div>
      <div
        ref={el => (gridRef = el)}
        onMouseMove={handleMouse}
        onMouseDown={handleMouse}
        onContextMenu={handleMouse}
        style={{
          'display': 'grid',
          'grid-template-columns': `repeat(${state.width}, 1fr)`,
          'grid-template-rows': `repeat(${state.height}, 1fr)`,
          'gap': '1px',
          'width': '75vh',
          'height': '75vh',
        }}
      >
        <For each={state.tiles}>
          {line => (
            <For each={line}>
              {tile => <div style={{ 'background-color': colors[tile] }}></div>}
            </For>
          )}
        </For>
      </div>
    </div>
  )
}

export default App
