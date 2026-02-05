import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  type User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  arrayUnion,
  getDoc
} from "firebase/firestore";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDnfytB6714BdUUMRMD8RjB-VFxiRq-ShM",
  authDomain: "shuffle-raid-bf1c3.firebaseapp.com",
  projectId: "shuffle-raid-bf1c3",
  storageBucket: "shuffle-raid-bf1c3.firebasestorage.app",
  messagingSenderId: "471193527658",
  appId: "1:471193527658:web:cc8666660b7967975af113",
  measurementId: "G-JWLQR80K84"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// --- TIPOS ---
interface Ability {
  id: string;
  name: string;
  type: 'Attack' | 'Support' | 'Basic';
  cost: number;
  cooldown: number;
  desc: string;
  icon: string;
}

interface Hero {
  uid: string;
  name: string;
  classType: string;
  hp: number;
  maxHp: number;
  def: number;
  pa: number; 
  maxPa: number;
  baseAtk: number;
  cooldowns: Record<string, number>;
}

interface RaidConfig {
  mode: 'campaign' | 'individual' | 'multi';
  difficulty: string;
  raidDeckSize: number;
}

interface ChatMessage {
  user: string;
  text: string;
  time: number;
}

// --- CONSTANTES ---
const CLASSES: Record<string, any> = {
  Warrior: {
    hp: 15, def: 2, baseAtk: 3, icon: 'fa-shield-halved',
    abilities: [
      { id: 'base', name: 'Golpe', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque básico.', icon: 'fa-hand-fist' },
      { id: 'offense', name: 'Ataque Fuerte', type: 'Attack', cost: 3, cooldown: 2, desc: '6 daño físico.', icon: 'fa-sword' },
      { id: 'support', name: 'Intervenir', type: 'Support', cost: 2, cooldown: 2, desc: 'Protege aliado.', icon: 'fa-shield-heart' }
    ]
  },
  Mage: {
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-wand-sparkles',
    abilities: [
      { id: 'base', name: 'Centella', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque mágico.', icon: 'fa-sparkles' },
      { id: 'offense', name: 'Incinerar', type: 'Attack', cost: 3, cooldown: 2, desc: 'Daño y quemadura.', icon: 'fa-fire' },
      { id: 'support', name: 'Escudo Mágico', type: 'Support', cost: 2, cooldown: 2, desc: 'Escudo de 2.', icon: 'fa-shield-halved' }
    ]
  },
  Hunter: {
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-crosshairs',
    abilities: [
      { id: 'base', name: 'Flecha', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque básico.', icon: 'fa-location-arrow' },
      { id: 'offense', name: 'Disparo Múltiple', type: 'Attack', cost: 3, cooldown: 2, desc: '2 flechas de 2.', icon: 'fa-arrows-to-eye' },
      { id: 'support', name: 'Distracción', type: 'Support', cost: 2, cooldown: 2, desc: 'Esquiva (D20).', icon: 'fa-bullseye' }
    ]
  }
};

const ENEMIES = [
  { name: "Horda de Goblins", hp: 7, maxHp: 7, damage: 2, def: 0, icon: 'fa-users-viewfinder', desc: "3 goblins salvajes." },
  { name: "Ogro", hp: 13, maxHp: 13, damage: 6, def: 1, icon: 'fa-hand-fist', desc: "Fuerza bruta." },
  { name: "Gólem de Granito", hp: 17, maxHp: 17, damage: 3, def: 1, icon: 'fa-mountain', skill: 'regen', desc: "Regenera 1 HP." },
  { name: "Esqueletos Vinculados", hp: 20, maxHp: 20, damage: 3, def: 1, icon: 'fa-skull-crossbones', skill: 'linked', subHp: [10, 10], desc: "Vínculo vital." },
  { name: "Lamía", hp: 20, maxHp: 20, damage: 3, def: 0, icon: 'fa-staff-snake', skill: 'lifesteal', desc: "Absorbe vida." }
];

// --- COMPONENTES AUXILIARES ---

function SubMenuLayout({ title, subtitle, onBack, children }: { title: string, subtitle: string, onBack: () => void, children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
      <button onClick={onBack} className="self-start mb-6 text-slate-300 hover:text-slate-900 flex items-center gap-2 font-black text-[10px] tracking-[0.3em] uppercase transition-colors">
        <i className="fa-solid fa-arrow-left"></i> Volver
      </button>
      <h1 className="text-3xl text-slate-900 fantasy-font mb-1 uppercase tracking-tighter text-center">{title}</h1>
      <p className="text-slate-400 mb-10 tracking-[0.2em] uppercase text-[9px] font-black text-center">{subtitle}</p>
      <div className="w-full max-w-xs space-y-3">{children}</div>
    </div>
  );
}

function DifficultySelector({ onSelect }: { onSelect: (diff: string, size: number) => void }) {
  const options = [
    { name: 'Fácil', size: 10 },
    { name: 'Normal', size: 15 },
    { name: 'Difícil', size: 20 },
    { name: 'Infinito', size: 999 }
  ];
  return (
    <>
      {options.map(opt => (
        <button key={opt.name} onClick={() => onSelect(opt.name, opt.size)} className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[10px] font-black text-slate-800 hover:border-amber-500 hover:bg-white transition-all uppercase tracking-widest shadow-sm">
          {opt.name}
        </button>
      ))}
    </>
  );
}

// --- VISTAS PRINCIPALES ---

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isReg, setIsReg] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isReg) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs animate-fade-in text-center">
        <h1 className="text-5xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
        <p className="text-slate-400 mb-12 uppercase tracking-[0.4em] text-[10px] font-black">Mesa de Rol v2.7</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="EMAIL" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="PASSWORD" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">
            {authLoading ? 'CARGANDO...' : (isReg ? 'CREAR CUENTA' : 'ENTRAR')}
          </button>
        </form>
        <button onClick={() => setIsReg(!isReg)} className="mt-8 text-slate-400 text-[9px] font-black tracking-widest uppercase">
          {isReg ? 'YA TENGO UN HÉROE' : 'NUEVO HÉROE'}
        </button>
      </div>
    </div>
  );
}

function LobbyWaiting({ raidId, user, onStart, onLeave }: { raidId: string, user: User, onStart: () => void, onLeave: () => void }) {
  const [raid, setRaid] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    return onSnapshot(doc(db, 'raids', raidId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      const data = snap.data();
      setRaid(data);
      if (data.status === 'combat') onStart();
    });
  }, [raidId]);

  const sendMessage = async () => {
    if (!msg.trim()) return;
    await updateDoc(doc(db, 'raids', raidId), {
      chat: arrayUnion({
        user: user.email?.split('@')[0] || 'Anónimo',
        text: msg,
        time: Date.now()
      })
    });
    setMsg('');
  };

  const launchGame = async () => {
    await updateDoc(doc(db, 'raids', raidId), { status: 'combat' });
  };

  if (!raid) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onLeave} className="text-slate-300 font-black text-[10px] uppercase tracking-widest"><i className="fa-solid fa-xmark mr-2"></i> Salir</button>
        <div className="bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Sala:</span>
           <span className="text-[10px] font-bold text-slate-900">{raidId.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-6 overflow-hidden">
        <div>
          <h2 className="fantasy-font text-2xl uppercase mb-1">Sala de Espera</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Comparte el código para jugar con amigos</p>
          
          <div className="space-y-3">
            {raid.players?.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-fade-in">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <i className={`fa-solid ${CLASSES[p.classType]?.icon || 'fa-user'}`}></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-900">{p.name || 'Héroe'}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p.classType}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-grow bg-slate-50 rounded-3xl border border-slate-100 flex flex-col overflow-hidden shadow-inner">
          <div className="flex-grow p-4 overflow-y-auto no-scrollbar space-y-3">
            {raid.chat?.map((c: ChatMessage, i: number) => (
              <div key={i} className={`flex flex-col ${c.user === user.email?.split('@')[0] ? 'items-end' : 'items-start'}`}>
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-1">{c.user}</span>
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 text-[10px] font-bold text-slate-700 shadow-sm max-w-[80%]">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              placeholder="Escribe un mensaje..." 
              className="flex-grow bg-slate-50 px-4 py-3 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-amber-400 transition-all"
              value={msg} 
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all"><i className="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>

        {raid.hostId === user.uid && (
          <button onClick={launchGame} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all">INICIAR PARTIDA</button>
        )}
      </div>
    </div>
  );
}

function GameBoard({ raidId, hero: initialHero, onLeave }: { raidId: string, hero: Hero, onLeave: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [heroState, setHeroState] = useState<Hero>(initialHero);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'raids', raidId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      const data = snap.data();
      setSession({ id: snap.id, ...data });
      if (data.log) setLog(data.log);
    });
  }, [raidId]);

  const drawEncounter = async () => {
    if (session.raidDeckRemaining === 0 && session.difficulty !== 'Infinito') {
      await updateDoc(doc(db, 'raids', raidId), { status: 'final_victory' });
      return;
    }
    const baseEnemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const newRemaining = session.difficulty === 'Infinito' ? 999 : Math.max(0, session.raidDeckRemaining - 1);
    await updateDoc(doc(db, 'raids', raidId), {
      status: 'combat',
      enemy: { ...baseEnemy, hp: baseEnemy.hp, maxHp: baseEnemy.maxHp, subHp: baseEnemy.subHp ? [...baseEnemy.subHp] : null },
      raidDeckRemaining: newRemaining,
      log: arrayUnion(`¡Un ${baseEnemy.name} aparece!`)
    });
  };

  const useAbility = async (ability: Ability) => {
    if (heroState.pa < ability.cost || (heroState.cooldowns[ability.id] || 0) > 0 || !session?.enemy || busy) return;
    setBusy(true);
    let damage = (ability.id === 'base' ? heroState.baseAtk : (ability.id === 'offense' ? 6 : 0));
    const actualDamage = Math.max(1, damage - (session.enemy.def || 0));
    const newEnemyHp = Math.max(0, session.enemy.hp - actualDamage);
    setHeroState(prev => ({ ...prev, pa: prev.pa - ability.cost, cooldowns: { ...prev.cooldowns, [ability.id]: ability.cooldown } }));
    if (newEnemyHp === 0) {
      await updateDoc(doc(db, 'raids', raidId), { status: 'victory', enemy: null, log: arrayUnion(`¡${ability.name}! El enemigo cae.`) });
    } else {
      await updateDoc(doc(db, 'raids', raidId), { 'enemy.hp': newEnemyHp, log: arrayUnion(`${heroState.classType} usa ${ability.name}.`) });
    }
    setBusy(false);
  };

  const endTurn = async () => {
    if (!session?.enemy || busy) return;
    setBusy(true);
    const dmg = Math.max(1, session.enemy.damage - heroState.def);
    const newCooldowns = { ...heroState.cooldowns };
    Object.keys(newCooldowns).forEach(k => { if (newCooldowns[k] > 0) newCooldowns[k] -= 1; });
    setHeroState(prev => ({ ...prev, hp: Math.max(0, prev.hp - dmg), pa: 5, cooldowns: newCooldowns }));
    await updateDoc(doc(db, 'raids', raidId), { log: arrayUnion(`Contraataque: Recibes ${dmg} daño.`) });
    setBusy(false);
  };

  if (session?.status === 'final_victory' || heroState.hp <= 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-6 text-center animate-fade-in">
        <h1 className={`text-6xl fantasy-font mb-4 ${heroState.hp <= 0 ? 'text-red-600' : 'text-amber-500'}`}>{heroState.hp <= 0 ? 'MUERTO' : 'ÉPICO'}</h1>
        <button onClick={onLeave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">SALIR</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><i className={`fa-solid ${CLASSES[heroState.classType].icon}`}></i></div>
          <div><h2 className="text-[10px] fantasy-font font-black uppercase text-slate-900 leading-none mb-1">{heroState.classType}</h2><div className="flex gap-1">{[...Array(heroState.maxHp)].map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full ${i < heroState.hp ? 'bg-red-500' : 'bg-slate-200'}`}></div>))}</div></div>
        </div>
        <div className="text-right text-[8px] font-black text-slate-400 uppercase">{session?.difficulty} • {session?.raidDeckRemaining} rest.</div>
      </div>

      <div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden">
        <div className="flex-grow bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col items-center justify-center relative p-6 shadow-inner">
          {session?.status === 'combat' && session.enemy ? (
            <div className="text-center animate-fade-in w-full max-w-sm">
              <i className={`fa-solid ${session.enemy.icon} text-8xl text-slate-900 mb-6 drop-shadow-2xl`}></i>
              <h3 className="fantasy-font text-xl uppercase mb-1">{session.enemy.name}</h3>
              <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden mx-auto border border-white"><div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(session.enemy.hp / session.enemy.maxHp) * 100}%` }}></div></div>
              <span className="text-[9px] font-black text-slate-500 mt-2 block">HP: {session.enemy.hp}</span>
            </div>
          ) : (
            <div onClick={drawEncounter} className="flex flex-col items-center cursor-pointer group">
              <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center text-amber-500 text-4xl shadow-2xl transition-transform group-hover:scale-110 active:scale-95"><i className="fa-solid fa-skull"></i></div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Toca para avanzar</p>
            </div>
          )}
        </div>
        <div className="h-28 bg-white rounded-3xl border border-slate-100 p-4 overflow-y-auto no-scrollbar">
          {log.slice().reverse().map((m, i) => (<p key={i} className="text-[9px] font-bold text-slate-500 mb-1 pl-3 border-l-2 border-amber-400 italic">{m}</p>))}
        </div>
      </div>

      <div className="p-4 bg-slate-900 rounded-t-[40px]">
        <div className="flex justify-between items-center mb-4 px-2"><span className="text-[10px] font-black text-white uppercase tracking-widest">PA: {heroState.pa}</span><div className="flex gap-1">{[...Array(5)].map((_, i) => (<div key={i} className={`w-3 h-3 rounded-sm rotate-45 ${i < heroState.pa ? 'bg-amber-400' : 'bg-slate-700'}`}></div>))}</div></div>
        <div className="flex gap-3 h-28">
          {CLASSES[heroState.classType].abilities.map((ability: Ability) => {
            const cd = heroState.cooldowns[ability.id] || 0;
            return (
              <button key={ability.id} onClick={() => useAbility(ability)} disabled={cd > 0 || heroState.pa < ability.cost || session?.status !== 'combat' || busy} className="flex-grow bg-slate-800 rounded-3xl flex flex-col items-center justify-center p-2 relative ability-btn border border-white/5">
                {cd > 0 && <div className="absolute inset-0 rounded-3xl cooldown-overlay text-xl">{cd}</div>}
                <i className={`fa-solid ${ability.icon} text-2xl text-amber-500 mb-2`}></i>
                <span className="text-[8px] font-black text-white uppercase truncate w-full text-center">{ability.name}</span>
                <span className="text-[7px] font-bold text-slate-400">{ability.cost} PA</span>
              </button>
            );
          })}
          <button onClick={endTurn} disabled={!session?.enemy || busy} className="w-16 bg-white rounded-3xl flex flex-col items-center justify-center text-slate-900 ability-btn"><i className="fa-solid fa-hourglass-end text-xl"></i></button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lobby' | 'campaign' | 'individual' | 'multi_menu' | 'difficulty' | 'selection' | 'lobby_waiting' | 'game'>('lobby');
  const [raidConfig, setRaidConfig] = useState<RaidConfig | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [raidId, setRaidId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const startSetup = (mode: any) => {
    setRaidConfig({ mode, difficulty: 'Normal', raidDeckSize: 15 });
    setView('difficulty');
  };

  const finalizeJoin = async (id: string) => {
    const snap = await getDoc(doc(db, 'raids', id));
    if (snap.exists()) {
      setRaidId(id);
      setView('selection');
    } else {
      alert("Código de sala inválido");
    }
  };

  const finalizeGame = async (classType: string) => {
    if (!user || (!raidConfig && !raidId)) return;
    const config = CLASSES[classType];
    const newHero: Hero = { uid: user.uid, name: user.email?.split('@')[0] || 'Héroe', classType, hp: 15, maxHp: 15, def: config.def, pa: 5, maxPa: 5, baseAtk: config.baseAtk, cooldowns: {} };
    setHero(newHero);

    if (raidId) {
      await updateDoc(doc(db, 'raids', raidId), { players: arrayUnion({ uid: user.uid, name: newHero.name, classType }) });
      setView('lobby_waiting');
    } else {
      const docRef = await addDoc(collection(db, 'raids'), {
        hostId: user.uid, status: 'waiting', mode: raidConfig?.mode, difficulty: raidConfig?.difficulty, raidDeckRemaining: raidConfig?.raidDeckSize,
        players: [{ uid: user.uid, name: newHero.name, classType }], chat: [], log: [`${classType} inició la aventura.`], createdAt: Date.now()
      });
      setRaidId(docRef.id);
      setView(raidConfig?.mode === 'multi' ? 'lobby_waiting' : 'game');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white fantasy-font text-2xl uppercase tracking-widest animate-pulse">Cargando Reino...</div>;
  if (!user) return <AuthScreen />;
  if (view === 'lobby_waiting' && raidId) return <LobbyWaiting raidId={raidId} user={user} onStart={() => setView('game')} onLeave={() => { setRaidId(null); setView('lobby'); }} />;
  if (view === 'game' && raidId && hero) return <GameBoard raidId={raidId} hero={hero} onLeave={() => { setRaidId(null); setView('lobby'); }} />;

  switch (view) {
    case 'lobby':
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-6xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-16">Mesa de Rol v2.7</p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => startSetup('campaign')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">CAMPAÑA</button>
            <button onClick={() => startSetup('individual')} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[28px] font-black uppercase text-[10px] active:scale-95 transition-all">INDIVIDUAL</button>
            <button onClick={() => setView('multi_menu')} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[28px] font-black uppercase text-[10px] active:scale-95 transition-all">MULTIJUGADOR</button>
            <button onClick={() => signOut(auth)} className="mt-8 text-slate-300 py-4 font-black uppercase tracking-widest text-[8px]">DESCONECTAR</button>
          </div>
        </div>
      );
    case 'multi_menu':
      return (
        <SubMenuLayout title="Multijugador" subtitle="Mazmorra de Gremio" onBack={() => setView('lobby')}>
          <button onClick={() => startSetup('multi')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all mb-4">CREAR PARTIDA</button>
          <div className="w-full border-t border-slate-100 pt-6 mt-4">
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-3 text-center">Unirse a una partida</p>
            <input 
              type="text" 
              placeholder="PEGA EL CÓDIGO AQUÍ" 
              className="w-full bg-slate-50 border border-slate-100 p-5 rounded-3xl text-[10px] font-black text-center mb-3 outline-none focus:border-amber-400"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
            />
            <button 
              onClick={() => finalizeJoin(joinCode)} 
              disabled={!joinCode.trim()}
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 py-4 rounded-3xl font-black uppercase text-[9px] tracking-widest hover:bg-white disabled:opacity-50 transition-all"
            >
              UNIRSE CON CÓDIGO
            </button>
          </div>
        </SubMenuLayout>
      );
    case 'difficulty':
      return (
        <SubMenuLayout title="Dificultad" subtitle="Elige el riesgo" onBack={() => setView('lobby')}>
          <DifficultySelector onSelect={(diff, size) => { setRaidConfig(prev => prev ? ({...prev, difficulty: diff, raidDeckSize: size}) : null); setView('selection'); }} />
        </SubMenuLayout>
      );
    case 'selection':
      return (
        <SubMenuLayout title="Héroe" subtitle="Elige tu clase" onBack={() => setView('lobby')}>
          {Object.keys(CLASSES).map(key => (
            <button key={key} onClick={() => finalizeGame(key)} className="w-full flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[28px] hover:border-amber-400 group active:scale-95 transition-all">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl"><i className={`fa-solid ${CLASSES[key].icon}`}></i></div>
              <div className="text-left flex-grow">
                <h3 className="fantasy-font text-sm text-slate-900 uppercase">{key}</h3>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Vida: 15 • Def: {CLASSES[key].def}</p>
              </div>
            </button>
          ))}
        </SubMenuLayout>
      );
    default: return null;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);