import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarChart3, Clock3, Gamepad2, LayoutDashboard, Link2, Medal, Pause, RotateCcw, Settings2, Share2, Trophy } from 'lucide-react'
import './styles.css'

type Card = { id: string; emoji: string; label: string; image?: string }
type Session = { id: string; name: string; open: boolean; leaderboard: boolean; nicknamesRequired: boolean; status: 'waiting'|'live'|'ended'; code: string; draftCards: Card[]; publishedCards: Card[] }
type Result = { id: string; sessionId: string; pseudo: string; time: number; moves: number; pairs: number; date: string }
type Player = { id:string; pseudo:string; joinedAt:string; lastSeen:string }

const starterCards: Card[] = [
  { id:'1', emoji:'🍓', label:'Fraise' }, { id:'2', emoji:'🍋', label:'Citron' },
  { id:'3', emoji:'🍉', label:'Pastèque' }, { id:'4', emoji:'🍇', label:'Raisin' },
  { id:'5', emoji:'🥑', label:'Avocat' }, { id:'6', emoji:'🍒', label:'Cerise' },
  { id:'7', emoji:'🍊', label:'Orange' }, { id:'8', emoji:'🫐', label:'Myrtilles' },
]

const STORAGE_SESSION = 'memory-session-v1'
const STORAGE_RESULTS = 'memory-results-v1'
const STORAGE_PLAYERS = 'memory-players-v1'

function loadSession(): Session {
  const saved = localStorage.getItem(STORAGE_SESSION)
  if (saved) {
    const session = JSON.parse(saved)
    return { ...session, status: session.status || 'waiting', code: session.code || 'ABC123' }
  }
  return { id:'anim-2026', name:'Memory Fruits', open:true, leaderboard:true, nicknamesRequired:false, status:'waiting', code:'ABC123', draftCards:[...starterCards], publishedCards:[...starterCards] }
}

function shuffle<T>(items:T[]) { return [...items].sort(() => Math.random() - 0.5) }

function App() {
  const [session, setSession] = useState<Session>(loadSession)
  const [results, setResults] = useState<Result[]>(() => JSON.parse(localStorage.getItem(STORAGE_RESULTS) || '[]'))
  const [view, setView] = useState<'game'|'leaderboard'|'admin'>(() => {
    if (new URLSearchParams(location.search).has('join') || location.hash === '#game') return 'game'
    if (location.hash === '#leaderboard') return 'leaderboard'
    return 'admin'
  })
  const [players, setPlayers] = useState<Player[]>(() => JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]'))

  useEffect(() => localStorage.setItem(STORAGE_SESSION, JSON.stringify(session)), [session])
  useEffect(() => localStorage.setItem(STORAGE_RESULTS, JSON.stringify(results)), [results])
  useEffect(() => localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players)), [players])
  useEffect(() => { location.hash = view === 'game' ? '' : view }, [view])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_SESSION && event.newValue) setSession(JSON.parse(event.newValue))
      if (event.key === STORAGE_RESULTS && event.newValue) setResults(JSON.parse(event.newValue))
      if (event.key === STORAGE_PLAYERS && event.newValue) setPlayers(JSON.parse(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('game')}><span className="brand-mark"><Gamepad2 size={22}/></span><span>Memory<span className="brand-dot">.</span></span></button>
        <nav className="nav-tabs">
          <button className={view==='game'?'active':''} onClick={() => setView('game')}><Gamepad2 size={17}/> Jouer</button>
          {session.leaderboard && <button className={view==='leaderboard'?'active':''} onClick={() => setView('leaderboard')}><Trophy size={17}/> Classement</button>}
          <button className={view==='admin'?'active':''} onClick={() => setView('admin')}><LayoutDashboard size={17}/> Administration</button>
        </nav>
        <div className="live-pill"><span/> {session.open ? 'Session ouverte' : 'Session fermée'}</div>
      </header>

      <main>
        {view === 'game' && <GameView session={session} results={results} players={players} setPlayers={setPlayers} onFinish={(result) => setResults(r => [...r, result])}/>} 
        {view === 'leaderboard' && <Leaderboard session={session} results={results}/>} 
        {view === 'admin' && <AdminView session={session} results={results} players={players} setSession={setSession} setResults={setResults} setPlayers={setPlayers}/>} 
      </main>
    </div>
  )
}

function GameView({ session, results, players, setPlayers, onFinish }: {session:Session; results:Result[]; players:Player[]; setPlayers:React.Dispatch<React.SetStateAction<Player[]>>; onFinish:(r:Result)=>void}) {
  const [gameId] = useState(() => crypto.randomUUID())
  const [cards, setCards] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [playerId] = useState(() => sessionStorage.getItem('memory-player-id') || crypto.randomUUID())
  const lock = useRef(false)

  const reset = () => {
    const pairs = session.publishedCards.flatMap(card => [{...card, id:`${card.id}-a`}, {...card, id:`${card.id}-b`}])
    setCards(shuffle(pairs)); setFlipped([]); setMatched([]); setMoves(0); setSeconds(0); setStarted(false); setFinished(false); lock.current=false
  }
  useEffect(reset, [session.publishedCards])
  useEffect(() => { if (!started || finished) return; const timer=setInterval(() => setSeconds(s=>s+1),1000); return()=>clearInterval(timer) }, [started, finished])

  const flip = (card:Card) => {
    if (lock.current || flipped.includes(card.id) || matched.includes(card.id) || finished) return
    if (!started) setStarted(true)
    const next=[...flipped,card.id]; setFlipped(next)
    if (next.length===2) {
      setMoves(m=>m+1); lock.current=true
      const [a,b]=next.map(id=>cards.find(c=>c.id===id)!)
      if (a.label===b.label) {
        const newMatched=[...matched,a.id,b.id]; setMatched(newMatched); setFlipped([]); lock.current=false
        if (newMatched.length===cards.length) {
          setTimeout(() => setFinished(true), 350)
        }
      } else setTimeout(() => {setFlipped([]); lock.current=false}, 700)
    }
  }

  useEffect(() => {
    if (!finished || matched.length!==cards.length || cards.length===0) return
    const savedKey=`saved-${gameId}`
    if (sessionStorage.getItem(savedKey)) return
    sessionStorage.setItem(savedKey,'true')
  }, [finished])

  const saveResult = () => {
    if (!finished) return
    if (session.nicknamesRequired && !pseudo.trim()) {
      alert('Veuillez saisir votre pseudo avant d’enregistrer le score.')
      return
    }
    onFinish({id:crypto.randomUUID(),sessionId:session.id,pseudo:pseudo.trim()||`Joueur ${results.length+1}`,time:seconds,moves,pairs:matched.length/2,date:new Date().toISOString()})
    setViewFinished(false)
  }

  const [viewFinished,setViewFinished] = useState(false)
  useEffect(() => { if (finished) setViewFinished(true) }, [finished])

  useEffect(() => {
    sessionStorage.setItem('memory-player-id', playerId)
  }, [playerId])

  useEffect(() => {
    if (!session.open) return
    const joinOrUpdate = () => {
      const name = pseudo.trim() || 'Joueur'
      setPlayers(current => {
        const existing = current.find(player => player.id === playerId)
        return [
          ...current.filter(player => player.id !== playerId),
          { id:playerId, pseudo:name, joinedAt:existing?.joinedAt || new Date().toISOString(), lastSeen:new Date().toISOString() }
        ]
      })
    }
    joinOrUpdate()
    const heartbeat = window.setInterval(joinOrUpdate, 4000)
    const leave = () => setPlayers(current => current.filter(player => player.id !== playerId))
    window.addEventListener('beforeunload', leave)
    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('beforeunload', leave)
    }
  }, [playerId, pseudo, session.open, setPlayers])

  useEffect(() => {
    const purge = () => {
      setPlayers(current => {
        const cutoff = Date.now() - 15000
        const active = current.filter(player => player.lastSeen && new Date(player.lastSeen).getTime() > cutoff)
        return active.length === current.length ? current : active
      })
    }
    const timer = window.setInterval(purge, 5000)
    return () => window.clearInterval(timer)
  }, [])

  if (!session.open) return <section className="closed-state"><div className="closed-icon"><Pause size={34}/></div><p className="eyebrow">SESSION INDISPONIBLE</p><h1>La partie est fermée</h1><p>Revenez plus tard ou demandez à l'administrateur d'ouvrir l'animation.</p></section>

  if (session.status === 'waiting') return <section className="waiting-room"><div className="waiting-card"><div className="waiting-icon"><Clock3 size={34}/></div><p className="eyebrow">CODE {session.code}</p><h1>{session.name}</h1><p className="waiting-copy">Vous êtes dans la salle d'attente. La partie commencera au lancement par l'administrateur.</p><label className="field"><span>Votre pseudo</span><input value={pseudo} onChange={e=>setPseudo(e.target.value)} placeholder={session.nicknamesRequired?'Pseudo obligatoire':'Pseudo facultatif'}/></label><div className="waiting-status"><span/><strong>{players.length}</strong> joueur{players.length>1?'s':''} connecté{players.length>1?'s':''}</div></div></section>

  return <section className="game-layout">
    <div className="game-head">
      <div><p className="eyebrow">SESSION EN COURS</p><h1>{session.name}</h1></div>
      <div className="game-stats">
        <div><Clock3 size={18}/><span>Temps</span><strong>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong></div>
        <div><RotateCcw size={18}/><span>Coups</span><strong>{moves}</strong></div>
      </div>
    </div>
    <div className="board">
      {cards.map(card => {
        const isVisible=flipped.includes(card.id)||matched.includes(card.id)
        return <button key={card.id} className={`memory-card ${isVisible?'flipped':''} ${matched.includes(card.id)?'matched':''}`} onClick={() => flip(card)} aria-label={isVisible?card.label:'Carte mémoire'}>
          <div className="card-inner"><div className="card-back"><span>?</span></div><div className="card-front">{card.image?<img className="card-image" src={card.image} alt={card.label}/>:<span>{card.emoji}</span>}<small>{card.label}</small></div></div>
        </button>
      })}
    </div>
    {viewFinished && <div className="modal-backdrop"><div className="success-modal"><div className="trophy-bubble"><Trophy size={42}/></div><p className="eyebrow">PARTIE TERMINÉE</p><h2>Bravo, vous avez réussi !</h2><div className="result-row"><div><span>Temps</span><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></div><div><span>Coups</span><strong>{moves}</strong></div><div><span>Paires</span><strong>{matched.length/2}/{cards.length/2}</strong></div></div>
      {session.nicknamesRequired && <label className="field"><span>Votre pseudo</span><input value={pseudo} onChange={e=>setPseudo(e.target.value)} placeholder="Ex. Alex"/></label>}
      {!session.nicknamesRequired && <label className="field"><span>Pseudo <small>(facultatif)</small></span><input value={pseudo} onChange={e=>setPseudo(e.target.value)} placeholder="Ex. Alex"/></label>}
      <div className="modal-actions"><button className="btn secondary" onClick={()=>{setViewFinished(false);reset()}}>Rejouer</button><button className="btn primary" onClick={()=>{saveResult();setViewFinished(false)}}>{session.leaderboard?'Enregistrer mon score':'Terminer'}</button></div>
    </div></div>}
  </section>
}

function Leaderboard({session,results}:{session:Session;results:Result[]}) {
  const rows=useMemo(()=>results.filter(r=>r.sessionId===session.id).sort((a,b)=>a.time-b.time||a.moves-b.moves).slice(0,20),[results,session.id])
  return <section className="content-page"><div className="page-heading"><div><p className="eyebrow">CLASSEMENT GÉNÉRAL</p><h1>Les meilleurs joueurs</h1></div><Medal size={38}/></div>
    {rows.length===0 ? <div className="empty-state"><Trophy size={38}/><h2>Aucun score pour le moment</h2><p>Terminez une partie pour apparaître ici.</p></div> : <div className="leaderboard-card"><div className="leader-head"><span>Rang</span><span>Joueur</span><span>Temps</span><span>Coups</span></div>{rows.map((r,i)=><div className={`leader-row ${i<3?'podium':''}`} key={r.id}><strong className="rank">{i+1}</strong><div className="player"><span className="avatar">{r.pseudo.charAt(0).toUpperCase()}</span><div><strong>{r.pseudo}</strong><small>{new Date(r.date).toLocaleDateString('fr-FR')} {new Date(r.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></div></div><strong>{Math.floor(r.time/60)}:{String(r.time%60).padStart(2,'0')}</strong><strong>{r.moves}</strong></div>)}</div>}
  </section>
}

function AdminView({session,results,players,setSession,setResults,setPlayers}:{session:Session;results:Result[];players:Player[];setSession:React.Dispatch<React.SetStateAction<Session>>;setResults:React.Dispatch<React.SetStateAction<Result[]>>;setPlayers:React.Dispatch<React.SetStateAction<Player[]>>}) {
  const [tab,setTab]=useState<'overview'|'content'|'share'>('overview')
  const [name,setName] = useState(session.name)
  const sessionResults = results.filter(r => r.sessionId === session.id)
  const shareUrl = `${location.origin}${location.pathname}?join=${encodeURIComponent(session.code)}#game`
  const adminUrl = `${location.origin}${location.pathname}#admin`
  const participantUrl = `${location.origin}${location.pathname}?join=${encodeURIComponent(session.code)}#game`
  const publish = () => setSession(s => ({...s, name, publishedCards: [...s.draftCards]}))

  return <section className="admin-layout"><aside className="admin-sidebar"><div className="admin-profile"><span className="profile-avatar">A</span><div><strong>Administrateur</strong><small>Mode gestion</small></div></div><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Vue d'ensemble</button><button className={tab==='content'?'active':''} onClick={()=>setTab('content')}><Settings2 size={18}/> Contenu du jeu</button><button className={tab==='share'?'active':''} onClick={()=>setTab('share')}><Share2 size={18}/> Session & partage</button></aside>
    <div className="admin-content">
      {tab==='overview' && <><div className="page-heading"><div><p className="eyebrow">TABLEAU DE BORD</p><h1>Vue d'ensemble</h1></div></div><div className="metric-grid"><Metric icon={<Gamepad2/>} label="Parties jouées" value={sessionResults.length}/><Metric icon={<Clock3/>} label="Temps moyen" value={sessionResults.length?`${Math.round(sessionResults.reduce((a,r)=>a+r.time,0)/sessionResults.length/60)} min`:'—'}/><Metric icon={<RotateCcw/>} label="Coups moyens" value={sessionResults.length?Math.round(sessionResults.reduce((a,r)=>a+r.moves,0)/sessionResults.length):'—'}/></div><div className="admin-card"><div className="card-heading"><div><p className="eyebrow">DERNIÈRES PARTIES</p><h2>Activité récente</h2></div></div>{sessionResults.length===0?<div className="small-empty">Aucune partie enregistrée</div>:sessionResults.slice(-5).reverse().map(r=><div className="activity-row" key={r.id}><span className="avatar">{r.pseudo.charAt(0).toUpperCase()}</span><strong>{r.pseudo}</strong><span>{r.moves} coups</span><strong>{Math.floor(r.time/60)}:{String(r.time%60).padStart(2,'0')}</strong></div>)}</div></>}
      {tab==='content' && <><div className="page-heading"><div><p className="eyebrow">ÉDITION</p><h1>Contenu du jeu</h1></div><span className="draft-badge">Brouillon</span></div><div className="admin-card"><label className="field"><span>Nom de l'animation</span><input value={name} onChange={e=>setName(e.target.value)}/></label><div className="card-heading"><div><p className="eyebrow">PAIRES</p><h2>Cartes du Memory</h2></div></div><div className="card-editor">{session.draftCards.map((card,i)=><div className="editable-card" key={card.id}>{card.image?<img className="edit-preview" src={card.image} alt={card.label}/>:<span className="edit-emoji">{card.emoji}</span>}<div className="edit-card-fields"><input value={card.label} onChange={e=>setSession(s=>({...s,draftCards:s.draftCards.map((c,j)=>j===i?{...c,label:e.target.value}:c)}))}/><label className="image-upload">Choisir une image<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)resizeCardImage(file,image=>setSession(s=>({...s,draftCards:s.draftCards.map((c,j)=>j===i?{...c,image}:c)})))}}/></label>{card.image&&<button className="remove-image" onClick={()=>setSession(s=>({...s,draftCards:s.draftCards.map((c,j)=>j===i?{...c,image:undefined}:c)}))}>Supprimer l'image</button>}</div></div>)}</div><div className="publish-bar"><button className="btn primary" onClick={publish}>Publier les modifications</button></div></div></>}
      {tab==='share' && <><div className="page-heading"><div><p className="eyebrow">CONFIGURATION</p><h1>Session & partage</h1></div></div><div className="settings-grid"><div className="admin-card lobby-card"><div className="lobby-heading"><div><p className="eyebrow">SALLE D'ATTENTE</p><h2>{players.length} joueur{players.length>1?'s':''} connecté{players.length>1?'s':''}</h2></div><span className={`lobby-status ${session.status}`}>{session.status==='waiting'?'En attente':session.status==='live'?'Partie lancée':'Terminée'}</span></div><div className="player-list">{players.length===0?<p className="small-empty">Aucun joueur pour le moment</p>:players.map(player=><div className="lobby-player" key={player.id}><span className="avatar">{player.pseudo.charAt(0).toUpperCase()}</span><strong>{player.pseudo}</strong><span>Prêt</span></div>)}</div><div className="lobby-actions">{session.status==='waiting'?<button className="btn primary" onClick={()=>setSession(s=>({...s,status:'live',open:true}))}><Gamepad2 size={16}/> Lancer pour tous</button>:<button className="btn secondary" onClick={()=>{setPlayers([]);setSession(s=>({...s,status:'waiting'}))}}>Nouvelle salle d'attente</button>}<button className="btn secondary" onClick={()=>setSession(s=>({...s,status:'waiting',open:true}))}>Réinitialiser la salle</button></div></div><div className="admin-card"><h2>État de la session</h2><Toggle label="Session ouverte" checked={session.open} onChange={()=>setSession(s=>({...s,open:!s.open}))}/><Toggle label="Activer le classement" checked={session.leaderboard} onChange={()=>setSession(s=>({...s,leaderboard:!s.leaderboard}))}/><Toggle label="Pseudo obligatoire" checked={session.nicknamesRequired} onChange={()=>setSession(s=>({...s,nicknamesRequired:!s.nicknamesRequired}))}/><button className="btn danger" onClick={()=>{if(confirm('Réinitialiser toutes les statistiques ?'))setResults([])}}><RotateCcw size={16}/> Réinitialiser les statistiques</button></div><div className="admin-card share-card"><h2>Lien des participants</h2><div className="qr"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${encodeURIComponent(shareUrl)}`} alt="QR code de la session"/></div><div className="share-link admin-link"><Link2 size={16}/><input readOnly value={adminUrl}/><button onClick={()=>navigator.clipboard.writeText(adminUrl)}>Copier admin</button></div><div className="share-link"><Link2 size={16}/><input readOnly value={shareUrl}/><button onClick={()=>navigator.clipboard.writeText(shareUrl)}>Copier</button></div></div></div></>}
    </div>
  </section>
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:React.ReactNode}) { return <div className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div> }
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:()=>void}) { return <button className="toggle-row" onClick={onChange}><span>{label}</span><span className={`toggle ${checked?'on':''}`}><i/></span></button> }

function resizeCardImage(file: File, callback: (image:string)=>void) {
  if (!file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 480 / Math.max(image.width, image.height))
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      context?.drawImage(image, 0, 0, canvas.width, canvas.height)
      callback(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
