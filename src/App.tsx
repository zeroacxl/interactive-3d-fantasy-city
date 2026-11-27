import { useEffect, useRef, useState } from 'react'
import { Game, type HudState, type Place } from './game/engine'
import { MUSIC_TRACKS } from './game/audio'
import type { Weather } from './game/sky'

const WEATHERS: { id: Weather; label: string; icon: string }[] = [
  { id: 'sunny', label: 'Ensolarado', icon: '☀️' },
  { id: 'cloudy', label: 'Nublado', icon: '☁️' },
  { id: 'rain', label: 'Chuva', icon: '🌧️' },
  { id: 'storm', label: 'Tempestade', icon: '⛈️' },
]
const PLACES: { id: Place; label: string; icon: string }[] = [
  { id: 'tunel', label: 'Túnel submarino', icon: '🐠' },
  { id: 'portal', label: 'Portal da cidade', icon: '🌉' },
  { id: 'praca', label: 'Bulevar Aqua', icon: '🌴' },
  { id: 'torre', label: 'Saguão da torre', icon: '🏙️' },
  { id: 'topo', label: 'Topo da torre (620 m)', icon: '🚀' },
  { id: 'domo', label: 'Jardim exótico', icon: '🌺' },
  { id: 'bairro', label: 'Bairro das casas', icon: '🏡' },
  { id: 'estacao', label: 'Aqua Express', icon: '🚆' },
  { id: 'praia', label: 'Praia', icon: '🏖️' },
]

function Bubbles() {
  const items = Array.from({ length: 22 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((i) => {
        const s = 20 + ((i * 37) % 90)
        return (
          <span
            key={i}
            className="bubble"
            style={{ left: `${(i * 53) % 100}%`, width: s, height: s, animationDuration: `${12 + ((i * 7) % 14)}s`, animationDelay: `-${(i * 3) % 15}s` }}
          />
        )
      })}
    </div>
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [started, setStarted] = useState(false)
  const [hud, setHud] = useState<HudState | null>(null)
  const [hint, setHint] = useState(true)
  // configurações
  const [autoTime, setAutoTime] = useState(true)
  const [dayMin, setDayMin] = useState(8)
  const [weatherAuto, setWeatherAuto] = useState(true)
  const [volume, setVolume] = useState(0.7)
  const [music, setMusic] = useState(true)
  const [track, setTrack] = useState(0)
  const [shuffle, setShuffle] = useState(true)
  const [sens, setSens] = useState(1)
  const [hq, setHq] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    let game: Game | null = null
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        game = new Game(canvas)
        game.hud = (h) => setHud(h)
        game.onLock = (l) => {
          setLocked(l)
          if (l) setStarted(true)
        }
        game.build()
        game.start()
        gameRef.current = game
        ;(window as unknown as { __game?: Game }).__game = game
        setPhase('ready')
      } catch (e) {
        console.error(e)
        setError(String(e))
        setPhase('error')
      }
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(t)
      game?.dispose()
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    if (locked) {
      const t = setTimeout(() => setHint(false), 14000)
      return () => clearTimeout(t)
    }
  }, [locked])

  const g = () => gameRef.current
  const resume = () => g()?.lock()
  const showMenu = phase === 'ready' && !locked
  const prompt = hud?.prompt ? hud.prompt.replace(/^E — /, '') : null
  const isE = hud?.prompt?.startsWith('E — ')

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky-300 select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Carregando */}
      {phase === 'loading' && (
        <div className="aero-bg absolute inset-0 flex flex-col items-center justify-center text-white">
          <Bubbles />
          <div className="aero-title text-5xl font-extrabold tracking-wide">AQUA CITY</div>
          <div className="mt-3 text-lg opacity-90">Construindo a cidade de cristal…</div>
          <div className="mt-6 h-3 w-64 overflow-hidden rounded-full border border-white/70 bg-white/30">
            <div className="loadbar h-full w-1/2 rounded-full" />
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 p-8 text-center text-white">
          <div>
            <div className="mb-2 text-2xl font-bold">Não foi possível iniciar o 3D</div>
            <div className="opacity-80">Verifique se o WebGL está habilitado no navegador.</div>
            <pre className="mt-4 max-w-xl whitespace-pre-wrap text-xs opacity-60">{error}</pre>
          </div>
        </div>
      )}

      {/* HUD */}
      {phase === 'ready' && locked && hud && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3">
            <div className="aero-panel flex items-center gap-3 px-4 py-2 text-white">
              <span className="text-2xl">{hud.hour > 6 && hud.hour < 18.5 ? '☀️' : '🌙'}</span>
              <div className="leading-tight">
                <div className="text-xl font-bold tabular-nums">{hud.time}</div>
                <div className="text-xs opacity-90">{WEATHERS.find((w) => w.id === hud.weather)?.icon} {WEATHERS.find((w) => w.id === hud.weather)?.label}</div>
              </div>
            </div>
            <div className="aero-panel px-4 py-2 text-sm font-semibold text-white">📍 {hud.area}</div>
          </div>
          <div className="pointer-events-none absolute right-4 top-4 text-right text-xs text-white/90 drop-shadow">
            {hud.alt > 6 && <div className="aero-panel mb-1 inline-block px-3 py-1 text-sm font-bold">▲ {hud.alt} m</div>}
            <div className="opacity-70">{hud.fps} fps</div>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/40 shadow" />
          {prompt && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2">
              <div className="aero-panel flex items-center gap-3 px-5 py-3 text-lg font-semibold text-white">
                {isE && <span className="keycap">E</span>}
                {prompt}
              </div>
            </div>
          )}
          {hud.msg && (
            <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2">
              <div className="aero-panel px-5 py-2 text-base text-white">{hud.msg}</div>
            </div>
          )}
          {hud.elev && (
            <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2">
              <div className="aero-panel w-72 p-4 text-white">
                <div className="mb-2 text-sm font-bold uppercase tracking-widest opacity-90">Elevador Cristal</div>
                {hud.elev.names
                  .map((n, i) => ({ n, i }))
                  .reverse()
                  .map(({ n, i }) => (
                    <div
                      key={i}
                      className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm ${hud.elev!.current === i && !hud.elev!.moving ? 'bg-lime-400/60 font-bold' : hud.elev!.moving && hud.elev!.target === i ? 'bg-cyan-300/50 font-bold' : 'bg-white/15'}`}
                    >
                      <span className="keycap small">{i + 1}</span>
                      {n}
                    </div>
                  ))}
                <div className="mt-2 text-xs opacity-80">{hud.elev.moving ? 'Em movimento…' : 'Pressione 1–5 para escolher o andar'}</div>
              </div>
            </div>
          )}
          {hint && (
            <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-white drop-shadow-lg">
              <div className="aero-panel px-4 py-3 leading-6">
                <b>WASD</b> mover · <b>Shift</b> correr · <b>Espaço</b> pular · <b>E</b> interagir · <b>1–5</b> elevador · <b>C</b>/botão direito zoom · <b>Esc</b> menu
              </div>
            </div>
          )}
        </>
      )}

      {/* Tela inicial / menu */}
      {showMenu && (
        <div className="aero-bg absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
          <Bubbles />
          {!started ? (
            <div className="relative z-10 flex max-w-2xl flex-col items-center text-center text-white">
              <div className="aero-title text-6xl font-extrabold tracking-wider md:text-7xl">AQUA CITY</div>
              <div className="mt-1 text-lg font-semibold tracking-[0.3em] text-lime-200 drop-shadow">CIDADE DE CRISTAL · 2003</div>
              <p className="mt-6 max-w-lg text-base leading-relaxed opacity-95">
                Você acaba de entrar pelo túnel de vidro submerso. Atravesse o mar, chegue à cidade, entre nos prédios e nas casas, suba a torre de 620 metros e passeie pelo jardim exótico dentro do domo de cristal.
              </p>
              <button onClick={resume} className="aero-btn mt-8 px-12 py-4 text-2xl font-extrabold">
                ▶ Entrar na cidade
              </button>
              <div className="aero-panel mt-8 grid grid-cols-2 gap-x-8 gap-y-1 px-6 py-4 text-left text-sm">
                <span><b>W A S D</b> — andar</span>
                <span><b>Mouse</b> — olhar</span>
                <span><b>Shift</b> — correr</span>
                <span><b>Espaço</b> — pular</span>
                <span><b>E</b> — interagir</span>
                <span><b>1–5</b> — elevador</span>
                <span><b>C</b> / botão dir. — zoom</span>
                <span><b>Esc</b> — menu / clima / hora</span>
              </div>
              <div className="mt-4 text-xs opacity-80">🚆 Explore a linha panorâmica Aqua Express · 4 trilhas musicais originais</div>
            </div>
          ) : (
            <div className="aero-panel relative z-10 w-full max-w-3xl p-6 text-white">
              <div className="mb-4 flex items-center justify-between">
                <div className="aero-title text-3xl font-extrabold">Menu · Aqua City</div>
                <button onClick={resume} className="aero-btn px-6 py-2 text-lg font-bold">▶ Continuar</button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <section>
                  <h3 className="mb-2 font-bold uppercase tracking-widest text-lime-200">Hora do dia</h3>
                  <div className="text-3xl font-bold tabular-nums">{hud?.time ?? '--:--'}</div>
                  <input
                    type="range"
                    min={0}
                    max={23.99}
                    step={0.05}
                    value={hud?.hour ?? 10}
                    onChange={(e) => {
                      g()?.setHour(parseFloat(e.target.value))
                      setHud((h) => (h ? { ...h, hour: parseFloat(e.target.value) } : h))
                    }}
                    className="aero-range w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs opacity-80"><span>🌙 meia-noite</span><span>🌅 amanhecer</span><span>☀️ meio-dia</span><span>🌇 pôr do sol</span></div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={autoTime} onChange={(e) => { setAutoTime(e.target.checked); g()?.setTimeFlow(e.target.checked, dayMin) }} />
                    Tempo passando automaticamente
                  </label>
                  <label className="mt-2 block text-sm">
                    Duração do dia: <b>{dayMin} min</b>
                    <input type="range" min={1} max={30} value={dayMin} onChange={(e) => { const v = parseInt(e.target.value); setDayMin(v); g()?.setTimeFlow(autoTime, v) }} className="aero-range w-full" />
                  </label>
                </section>
                <section>
                  <h3 className="mb-2 font-bold uppercase tracking-widest text-lime-200">Clima</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {WEATHERS.map((w) => (
                      <button key={w.id} onClick={() => { setWeatherAuto(false); g()?.setWeather(w.id) }} className={`aero-chip ${hud?.weather === w.id && !weatherAuto ? 'on' : ''}`}>
                        <span className="text-xl">{w.icon}</span> {w.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={weatherAuto} onChange={(e) => { setWeatherAuto(e.target.checked); g()?.setWeatherAuto(e.target.checked) }} />
                    Clima dinâmico (muda sozinho, com arco-íris depois da chuva)
                  </label>
                  <h3 className="mb-2 mt-5 font-bold uppercase tracking-widest text-lime-200">Som & Controles</h3>
                  <label className="block text-sm">Volume: <b>{Math.round(volume * 100)}%</b>
                    <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); g()?.audio.setVolume(v) }} className="aero-range w-full" />
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={music} onChange={(e) => { setMusic(e.target.checked); g()?.audio.setMusic(e.target.checked) }} /> Trilha musical
                  </label>
                  <label className="mt-2 block text-sm">Estação de rádio
                    <select aria-label="Trilha sonora" value={track} onChange={(e) => { const v = Number(e.target.value); setTrack(v); g()?.audio.setTrack(v) }} className="mt-1 w-full rounded-lg bg-slate-800 p-2 text-white">
                      {MUSIC_TRACKS.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={shuffle} onChange={(e) => { setShuffle(e.target.checked); if (g()) g()!.audio.shuffle = e.target.checked }} /> Alternar faixas automaticamente
                  </label>
                  <label className="mt-1 block text-sm">Sensibilidade do mouse: <b>{sens.toFixed(1)}x</b>
                    <input type="range" min={0.3} max={2.5} step={0.1} value={sens} onChange={(e) => { const v = parseFloat(e.target.value); setSens(v); if (g()) g()!.sens = v }} className="aero-range w-full" />
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={hq} onChange={(e) => { setHq(e.target.checked); g()?.setQuality(e.target.checked) }} /> Alta qualidade (sombras nítidas)
                  </label>
                </section>
              </div>
              <section className="mt-5">
                <h3 className="mb-2 font-bold uppercase tracking-widest text-lime-200">Ir para…</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {PLACES.map((p) => (
                    <button key={p.id} onClick={() => { g()?.teleport(p.id); resume() }} className="aero-chip">
                      <span className="text-xl">{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
