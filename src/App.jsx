import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from './projects.json'
import './App.css'

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  HTML: '#e34c26',
  CSS: '#563d7c',
}

function describe(repo) {
  return config.descriptions[repo.name] || repo.description || ''
}

// Candidate locations for a per-repo thumbnail, in priority order. The repo
// owner drops a `thumbnail.<ext>` (optionally inside a `thumbnail/` folder)
// into each project; we try each until one loads.
function thumbnailCandidates(repo) {
  const branch = repo.default_branch || 'main'
  const base = `https://raw.githubusercontent.com/${config.githubUsername}/${repo.name}/${branch}`
  const paths = [
    'thumbnail.png',
    'thumbnail.jpg',
    'thumbnail.jpeg',
    'thumbnail/thumbnail.png',
    'thumbnail/thumbnail.jpg',
    'thumbnail/thumbnail.jpeg',
  ]
  return paths.map((p) => `${base}/${p}`)
}

function Thumbnail({ repo }) {
  const candidates = thumbnailCandidates(repo)
  const [index, setIndex] = useState(0)

  if (index >= candidates.length) return null

  return (
    <div className="card-thumb">
      <img
        src={candidates[index]}
        alt={`${repo.name} thumbnail`}
        loading="lazy"
        onError={() => setIndex((i) => i + 1)}
      />
    </div>
  )
}

// Fallback project list built from the curated JSON, used if the
// GitHub API is unreachable or rate-limited.
function fallbackProjects() {
  return Object.entries(config.descriptions).map(([name, description]) => ({
    name,
    description,
    html_url: `https://github.com/${config.githubUsername}/${name}`,
    language: null,
    stargazers_count: 0,
    default_branch: 'main',
  }))
}

function ProjectCard({ repo }) {
  const description = describe(repo)
  return (
    <a className="card" href={repo.html_url} target="_blank" rel="noreferrer">
      <Thumbnail repo={repo} />
      <h3>{repo.name}</h3>
      {description && <p>{description}</p>}
      <div className="card-meta">
        {repo.language && (
          <span className="lang">
            <span
              className="lang-dot"
              style={{ background: LANGUAGE_COLORS[repo.language] || '#888' }}
            />
            {repo.language}
          </span>
        )}
        {repo.stargazers_count > 0 && (
          <span className="stars">★ {repo.stargazers_count}</span>
        )}
      </div>
    </a>
  )
}

// Minimal hash-based router. Hash routing avoids the GitHub Pages
// client-routing 404 problem (no server rewrite needed) — links like
// `#/projects` resolve entirely in the browser.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#/, '') || '/'
}

function Nav({ route }) {
  return (
    <nav className="nav">
      <a className={route === '/' ? 'active' : ''} href="#/">
        Home
      </a>
      <a className={route === '/projects' ? 'active' : ''} href="#/projects">
        Projects
      </a>
    </nav>
  )
}

function Prompt() {
  return (
    <span className="term-ps1">
      <span className="ps1-user">ali</span>@
      <span className="ps1-host">portfolio</span>
      <span className="ps1-path">:~$</span>
    </span>
  )
}

// Renders the output for a single entered command. Kept pure so the terminal
// can re-render lines live (e.g. `ls` updates once projects finish loading).
function findProject(projects, arg) {
  if (!projects || !arg) return null
  const target = arg.replace(/\/$/, '').toLowerCase()
  return projects.find((p) => p.name.toLowerCase() === target) || null
}

// Static documents (transcript, etc.) that `cd` can open alongside projects.
// They live in `public/`, so the URL is the deploy base plus the file name.
function findDocument(arg) {
  if (!arg) return null
  const target = arg.replace(/\/$/, '').toLowerCase()
  const entry = Object.entries(config.documents || {}).find(
    ([name]) => name.toLowerCase() === target,
  )
  if (!entry) return null
  const [name, file] = entry
  return { name, url: `${import.meta.env.BASE_URL}${file}` }
}

function CommandOutput({ cmd, projects }) {
  const [name, ...rest] = cmd.split(/\s+/)
  const arg = rest.join(' ')

  if (name === 'help') {
    return (
      <div className="term-out">
        Available commands:{'\n'}
        {'  '}whoami        — about me{'\n'}
        {'  '}ls            — list my GitHub projects{'\n'}
        {'  '}cd &lt;name&gt;     — open a project in a new tab{'\n'}
        {'  '}cd transcript — open my unofficial transcript{'\n'}
        {'  '}clear         — clear the terminal{'\n'}
        {'  '}help          — show this message
      </div>
    )
  }

  if (name === 'cd') {
    if (!arg) return <div className="term-out term-err">cd: missing operand</div>
    const doc = findDocument(arg)
    if (doc) {
      return (
        <div className="term-out">
          opening{' '}
          <a className="term-link" href={doc.url} target="_blank" rel="noreferrer">
            {doc.name}
          </a>{' '}
          …
        </div>
      )
    }
    if (projects === null) return <div className="term-out">fetching projects…</div>
    const project = findProject(projects, arg)
    if (!project) {
      return (
        <div className="term-out term-err">cd: no such project: {arg}</div>
      )
    }
    return (
      <div className="term-out">
        opening{' '}
        <a className="term-link" href={project.html_url} target="_blank" rel="noreferrer">
          {project.name}/
        </a>{' '}
        …
      </div>
    )
  }

  if (name === 'whoami') {
    return (
      <div className="term-out">
        {config.name}{'\n'}
        {config.tagline}
        {'\n\n'}
        {config.bio}
        {'\n\n'}
        {'GitHub:   '}
        <a className="term-link" href={config.links.github} target="_blank" rel="noreferrer">
          {config.links.github}
        </a>
        {'\n'}
        {'LinkedIn: '}
        <a className="term-link" href={config.links.linkedin} target="_blank" rel="noreferrer">
          {config.links.linkedin}
        </a>
      </div>
    )
  }

  if (name === 'ls') {
    if (projects === null) return <div className="term-out">fetching projects…</div>
    return (
      <div className="term-ls">
        {projects.map((p) => (
          <a
            key={p.name}
            className="term-link"
            href={p.html_url}
            target="_blank"
            rel="noreferrer"
          >
            {p.name}/
          </a>
        ))}
        {Object.keys(config.documents || {}).map((docName) => {
          const doc = findDocument(docName)
          return (
            <a
              key={doc.name}
              className="term-link"
              href={doc.url}
              target="_blank"
              rel="noreferrer"
            >
              {doc.name}
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <div className="term-out term-err">
      command not found: {name} — type <span className="term-hint">help</span>
    </div>
  )
}

function HomePage() {
  const { projects } = useProjects()
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const inputRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [history, projects])

  const submit = (e) => {
    e.preventDefault()
    const cmd = input.trim()
    setInput('')
    if (!cmd) return
    if (cmd === 'clear') {
      setHistory([])
      return
    }
    const [name, ...rest] = cmd.split(/\s+/)
    if (name === 'cd') {
      const arg = rest.join(' ')
      const doc = findDocument(arg)
      const project = doc ? null : findProject(projects, arg)
      const url = doc?.url || project?.html_url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
    setHistory((h) => [...h, cmd])
  }

  return (
    <section
      className="terminal"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="term-bar">
        <span className="term-dot red" />
        <span className="term-dot yellow" />
        <span className="term-dot green" />
        <span className="term-title">{config.name.toLowerCase().replace(/\s+/g, '')}@portfolio: ~</span>
      </div>

      <div className="term-body">
        <div className="term-intro">
          Welcome to {config.name}&apos;s shell.{'\n'}
          Type <span className="term-hint">help</span> to get started, or{' '}
          <span className="term-hint">ls</span> to see my projects.
        </div>

        {history.map((cmd, i) => (
          <div key={i} className="term-entry">
            <div className="term-cmd-line">
              <Prompt />
              <span className="term-cmd">{cmd}</span>
            </div>
            <CommandOutput cmd={cmd} projects={projects} />
          </div>
        ))}

        <form className="term-cmd-line" onSubmit={submit}>
          <Prompt />
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck="false"
            autoComplete="off"
            autoFocus
            aria-label="terminal input"
          />
        </form>
        <div ref={endRef} />
      </div>
    </section>
  )
}

// Fetches the curated, sorted list of public GitHub repos. Shared by the
// terminal `ls` command and the Projects grid. Returns null while loading.
function useProjects() {
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const url = `https://api.github.com/users/${config.githubUsername}/repos?per_page=100&sort=updated`
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
        return res.json()
      })
      .then((repos) => {
        const exclude = new Set(config.exclude)
        const filtered = repos
          .filter((r) => !r.fork && !exclude.has(r.name))
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
        setProjects(filtered)
      })
      .catch(() => {
        setError(true)
        setProjects(fallbackProjects())
      })
  }, [])

  return { projects, error }
}

// front, right, back, left, top, bottom
const FACE_TRANSFORMS = [
  'rotateY(0deg)',
  'rotateY(90deg)',
  'rotateY(180deg)',
  'rotateY(-90deg)',
  'rotateX(90deg)',
  'rotateX(-90deg)',
]

// The 8 corner directions, as CSS angles that point a line from the centre at
// each corner: rotateY(b) rotateX(a) turns +Z into (±1, ±1, ±1)/√3.
const CORNER_ANGLES = [-1, 1].flatMap((sx) =>
  [-1, 1].flatMap((sy) =>
    [-1, 1].map((sz) => ({
      a: (Math.asin(-sy / Math.sqrt(3)) * 180) / Math.PI,
      b: (Math.atan2(sx, sz) * 180) / Math.PI,
    })),
  ),
)

// Spread projects over the 6 faces as k×k tiles (n = k² per face), with k the
// smallest size that fits every project. Spare tiles get a random project.
function buildFaces(projects) {
  const k = Math.max(1, Math.ceil(Math.sqrt(projects.length / 6)))
  const n = k * k
  const tiles = [...projects]
  while (tiles.length < 6 * n) {
    tiles.push(projects[Math.floor(Math.random() * projects.length)])
  }
  return { k, faces: FACE_TRANSFORMS.map((_, i) => tiles.slice(i * n, (i + 1) * n)) }
}

// Rotate about the screen's axes (not the cube's), so dragging feels the same
// whichever way up the cube is. ax/ay are degrees about screen X/Y.
const turn = (m, ax, ay) => new DOMMatrix().rotate(ax, ay, 0).multiply(m)
// Held arrow keys ease the cube up to this spin speed (deg/ms) per axis.
const KEY_DIRS = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [1, 0],
  ArrowDown: [-1, 0],
}
const KEY_SPEED = 0.12
// Fraction of velocity kept per 16ms frame; exponential decay gives the ease-out.
const FRICTION = 0.94

function ProjectCube({ projects, rot, zoom }) {
  const { k, faces } = useMemo(() => buildFaces(projects), [projects])

  return (
    <div className="cube-wrap" style={{ '--zoom': zoom }}>
      <div className="cube-scene">
        <div
          className="cube"
          style={{ transform: `scale(${zoom}) ${rot}` }}
        >
          {faces.map((tiles, i) => (
            <div
              key={i}
              className="cube-face"
              style={{
                transform: `${FACE_TRANSFORMS[i]} translateZ(calc(var(--cube-size) / 2))`,
                gridTemplateColumns: `repeat(${k}, 1fr)`,
              }}
            >
              {tiles.map((repo, j) => (
                <ProjectCard key={j} repo={repo} />
              ))}
            </div>
          ))}
          {/* Tesseract: a breathing inner cube joined to the outer corners. */}
          {/* Inner faces mirror the outer tiles, scaled down; inert so only the outer links are clickable/focusable. */}
          {faces.map((tiles, i) => (
            <div
              key={`inner${i}`}
              className="cube-face tess-face"
              inert
              style={{
                transform: `${FACE_TRANSFORMS[i]} translateZ(calc(var(--cube-size) * var(--tess) / 2)) scale(var(--tess))`,
                gridTemplateColumns: `repeat(${k}, 1fr)`,
              }}
            >
              {tiles.map((repo, j) => (
                <ProjectCard key={j} repo={repo} />
              ))}
            </div>
          ))}
          {CORNER_ANGLES.map(({ a, b }, i) => (
            <div
              key={`edge${i}`}
              className="tess-edge"
              style={{
                transform: `rotateY(${b}deg) rotateX(${a}deg) translateZ(calc(var(--cube-size) * 0.866 * (1 + var(--tess)) / 2)) rotateX(90deg)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjectsPage() {
  const { projects, error } = useProjects()
  const [rot, setRot] = useState(() => turn(new DOMMatrix(), -20, 30))
  const drag = useRef(null)
  const moved = useRef(false)
  const vel = useRef({ x: 0, y: 0 }) // deg per ms
  const raf = useRef(0)
  const held = useRef(new Set())
  const [zoom, setZoom] = useState(1)
  const surface = useRef(null)

  // Wheel / trackpad pinch zooms. Attached by hand because React's onWheel is
  // passive and can't stop the page from scrolling.
  useEffect(() => {
    const el = surface.current
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) => Math.min(1.6, Math.max(0.5, z * Math.exp(-e.deltaY * 0.002))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Spin with the current velocity, decaying it each frame until it dies out.
  const coast = useCallback(() => {
    cancelAnimationFrame(raf.current)
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(now - last, 50)
      last = now
      const v = vel.current
      // Ease velocity toward the held-key target (0 when nothing is held = friction).
      let tx = 0
      let ty = 0
      for (const key of held.current) {
        tx += KEY_DIRS[key][0] * KEY_SPEED
        ty += KEY_DIRS[key][1] * KEY_SPEED
      }
      const keep = Math.pow(FRICTION, dt / 16)
      v.x = tx + (v.x - tx) * keep
      v.y = ty + (v.y - ty) * keep
      if (!held.current.size && Math.abs(v.x) + Math.abs(v.y) < 0.001) return
      const ax = v.x * dt
      const ay = v.y * dt
      setRot((r) => turn(r, ax, ay))
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [])

  // Arrow keys work whenever the projects page is open.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!KEY_DIRS[e.key]) return
      e.preventDefault()
      // OS key-repeat events are ignored; the frame loop drives held keys smoothly.
      if (held.current.has(e.key)) return
      held.current.add(e.key)
      coast()
    }
    const onKeyUp = (e) => held.current.delete(e.key)
    const onBlur = () => held.current.clear() // no stuck keys after alt-tab
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      cancelAnimationFrame(raf.current)
    }
  }, [coast])

  const onPointerDown = (e) => {
    cancelAnimationFrame(raf.current) // grabbing the cube stops it
    vel.current = { x: 0, y: 0 }
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    moved.current = false
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!moved.current) {
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) <= 5) return
      moved.current = true
      // Capture only once it is a real drag, so plain clicks still reach the tile links.
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const dx = (e.clientX - d.x) * 0.4
    const dy = -(e.clientY - d.y) * 0.4
    const dt = Math.max(e.timeStamp - d.t, 1)
    // Smoothed so one jittery event doesn't decide the flick speed.
    vel.current = {
      x: vel.current.x * 0.2 + (dy / dt) * 0.8,
      y: vel.current.y * 0.2 + (dx / dt) * 0.8,
    }
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    setRot((r) => turn(r, dy, dx))
  }
  const endDrag = (e) => {
    const d = drag.current
    drag.current = null
    if (!d || !moved.current) return
    // Paused before letting go: no flick.
    if (e.timeStamp - d.t > 60) vel.current = { x: 0, y: 0 }
    coast()
  }

  return (
    <section
      ref={surface}
      className="projects cube-drag"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // A drag that ends over a tile must not open it.
      onClickCapture={(e) => {
        if (moved.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <h2>Projects</h2>
      {error && (
        <p className="notice">
          Couldn&apos;t reach the GitHub API right now — showing a saved list.
        </p>
      )}
      {projects === null ? (
        <p className="notice">Loading projects…</p>
      ) : (
        <ProjectCube projects={projects} rot={rot} zoom={zoom} />
      )}
    </section>
  )
}

function App() {
  const route = useHashRoute()

  return (
    <main>
      <Nav route={route} />

      {route === '/projects' ? <ProjectsPage /> : <HomePage />}

      <footer>
        <p>
          Built with React + Vite ·{' '}
          <a href={config.links.github} target="_blank" rel="noreferrer">
            @{config.githubUsername}
          </a>
        </p>
      </footer>
    </main>
  )
}

export default App
