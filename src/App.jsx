import { useEffect, useRef, useState } from 'react'
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

function ProjectsPage() {
  const { projects, error } = useProjects()

  return (
    <section className="projects">
      <h2>Projects</h2>
      {error && (
        <p className="notice">
          Couldn&apos;t reach the GitHub API right now — showing a saved list.
        </p>
      )}
      {projects === null ? (
        <p className="notice">Loading projects…</p>
      ) : (
        <div className="grid">
          {projects.map((repo) => (
            <ProjectCard key={repo.name} repo={repo} />
          ))}
        </div>
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
