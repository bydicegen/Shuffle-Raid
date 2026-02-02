import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  arrayUnion, 
  where 
} from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TIPOS ---
interface Card {
  id: string;
  name: string;
  type: 'Attack' | 'Defend' | 'Heal' | 'Special';
  value: number;
  cost: number;
  desc: string;
  icon: string;
}

interface Hero {
  uid: string;
  classType: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  deck: Card[];
}

// --- CONSTANTES ---
const CLASSES: Record<string, any> = {
  Warrior: {
    hp: 100, mana: 3, icon: 'fa-shield-halved',
    deck: [
      { id: 'w1', name: 'Slash', type: 'Attack', value: 8, cost: 1, desc: 'A basic swing.', icon: 'fa-sword' },
      { id: 'w2', name: 'Bash', type: 'Attack', value: 12, cost: 2, desc: 'Heavy blow.', icon: 'fa-hammer' },
      { id: 'w3', name: 'Block', type: 'Defend', value: 10, cost: 1, desc: 'Guard up.', icon: 'fa-shield' },
      { id: 'w4', name: 'Rally', type: 'Heal', value: 8, cost: 2, desc: 'Recover breath.', icon: 'fa-heart' },
      { id: 'w5', name: 'Slash', type: 'Attack', value: 8, cost: 1, desc: 'A basic swing.', icon: 'fa-sword' }
    ]
  },
  Mage: {
    hp: 60, mana: 5, icon: 'fa-wand-sparkles',
    deck: [
      { id: 'm1', name: 'Fireball', type: 'Attack', value: 15, cost: 3, desc: 'Burn them!', icon: 'fa-fire' },
      { id: 'm2', name: 'Arcane Bolt', type: 'Attack', value: 6, cost: 1, desc: 'Fast magic.', icon: 'fa-bolt' },
      { id: 'm3', name: 'Mana Shield', type: 'Defend', value: 15, cost: 2, desc: 'Magic wall.', icon: 'fa-sun' },
      { id: 'm4', name: 'Meditation', type: 'Heal', value: 12, cost: 2, desc: 'Restore mind.', icon: 'fa-brain' },
      { id: 'm5', name: 'Arcane Bolt', type: 'Attack', value: 6, cost: 1, desc: 'Fast magic.', icon: 'fa-bolt' }
    ]
  },
  Rogue: {
    hp: 80, mana: 4, icon: 'fa-dagger',
    deck: [
      { id: 'r1', name: 'Stab', type: 'Attack', value: 10, cost: 1, desc: 'Precise strike.', icon: 'fa-dagger' },
      { id: 'r2', name: 'Dual Strike', type: 'Attack', value: 16, cost: 2, desc: 'Twice the pain.', icon: 'fa-scissors' },
      { id: 'r3', name: 'Evasion', type: 'Defend', value: 8, cost: 1, desc: 'Fast movement.', icon: 'fa-wind' },
      { id: 'r4', name: 'First Aid', type: 'Heal', value: 10, cost: 2, desc: 'Quick fix.', icon: 'fa-kit-medical' },
      { id: 'r5', name: 'Stab', type: 'Attack', value: 10, cost: 1, desc: 'Precise strike.', icon: 'fa-dagger' }
    ]
  }
};

const ENEMIES = [
  { name: "Skeletal Grunt", hp: 40, damage: 6, icon: 'fa-skeleton' },
  { name: "Void Wraith", hp: 60, damage: 10, icon: 'fa-ghost' },
  { name: "Infernal Hound", hp: 50, damage: 12, icon: 'fa-dog' },
  { name: "Orc Warlord", hp: 100, damage: 15, icon: 'fa-user-ninja' }
];

// --- COMPONENTES ---

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isReg, setIsReg] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isReg) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-3xl border-2 border-amber-600/30 w-full max-w-md shadow-2xl animate-fade-in">
        <h1 className="text-4xl fantasy-font text-amber-500 text-center mb-8">Chronicles</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 outline-none focus:border-amber-500 transition-all text-white" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 outline-none focus:border-amber-500 transition-all text-white" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="w-full bg-amber-600 py-4 rounded-xl fantasy-font tracking-widest hover:bg-amber-500 transition-all shadow-lg active:scale-95 text-white">
            {isReg ? 'CREAR HÉROE' : 'ENTRAR AL REINO'}
          </button>
        </form>
        <button onClick={() => setIsReg(!isReg)} className="w-full mt-6 text-slate-400 text-sm hover:text-amber-500 transition-colors">
          {isReg ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo aquí? Regístrate'}
        </button>
      </div>
    </div>
  );
}

function HeroSelection({ user, onCreated }: { user: User, onCreated: (h: Hero) => void }) {
  const handleSelect = async (type: string) => {
    const config = CLASSES[type];
    const newHero: Hero = {
      uid: user.uid,
      classType: type,
      hp: config.hp, maxHp: config.hp,
      mana: config.mana, maxMana: config.mana,
      level: 1, xp: 0,
      deck: config.deck
    };
    await setDoc(doc(db, 'users', user.uid), newHero);
    onCreated(newHero);
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <h2 className="text-4xl text-amber-500 fantasy-font mb-12 animate-fade-in">Elige tu Destino</h2>
      <div className="grid md:grid-cols-3 gap-8 w-full max-w-6xl">
        {Object.keys(CLASSES).map(type => (
          <div key={type} onClick={() => handleSelect(type)} className="bg-slate-800/50 border-2 border-slate-700 rounded-3xl p-8 hover:border-amber-500 cursor-pointer transition-all group flex flex-col items-center">
            <div className="text-6xl text-amber-600 mb-6 group-hover:scale-110 transition-transform"><i className={`fa-solid ${CLASSES[type].icon}`}></i></div>
            <h3 className="text-2xl text-white fantasy-font mb-4">{type}</h3>
            <div className="flex justify-between w-full text-sm font-bold bg-slate-900 p-3 rounded-xl border border-slate-700">
              <span className="text-red-400">HP: {CLASSES[type].hp}</span>
              <span className="text-blue-400">MANA: {CLASSES[type].mana}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Lobby({ hero, onJoin }: { hero: Hero, onJoin: (id: string) => void }) {
  const [raids, setRaids] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'raids'), where('status', 'in', ['lobby', 'combat']));
    return onSnapshot(q, (snap) => {
      setRaids(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const createRaid = async () => {
    const docRef = await addDoc(collection(db, 'raids'), {
      hostId: hero.uid,
      players: { [hero.uid]: { classType: hero.classType, level: hero.level } },
      status: 'lobby',
      log: [`Un aventurero ha iniciado la incursión.`]
    });
    onJoin(docRef.id);
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-12 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <div>
          <h1 className="text-2xl text-amber-500 fantasy-font">Taberna del Aventurero</h1>
          <p className="text-slate-400">Héroe: {hero.classType} Nivel {hero.level}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => signOut(auth)} className="text-slate-500 text-sm font-bold uppercase hover:text-red-500 transition-colors">Salir</button>
          <button onClick={createRaid} className="bg-amber-600 px-6 py-3 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg text-white">NUEVA MISIÓN</button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl fantasy-font text-slate-400 flex items-center gap-3"><i className="fa-solid fa-scroll"></i> Pergaminos de Misión</h2>
        {raids.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">No hay misiones activas en este momento.</div>
        ) : (
          raids.map(r => (
            <div key={r.id} className="bg-slate-800/40 border border-slate-800 p-6 rounded-2xl flex justify-between items-center hover:bg-slate-800 transition-all text-white">
              <div>
                <p className="font-bold text-amber-400">Incursión #{r.id.slice(0,5)}</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest">{r.status}</p>
              </div>
              <button onClick={() => onJoin(r.id)} className="bg-slate-700 px-6 py-2 rounded-xl hover:bg-amber-600 transition-all font-bold">UNIRSE</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GameBoard({ raidId, hero, onLeave }: { raidId: string, hero: Hero, onLeave: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [mana, setMana] = useState(hero.mana);
  const [hp, setHp] = useState(hero.hp);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'raids', raidId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      setSession({ id: snap.id, ...snap.data() });
    });
    return unsubscribe;
  }, [raidId, onLeave]);

  const startCombat = async () => {
    const enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    await updateDoc(doc(db, 'raids', raidId), {
      status: 'combat',
      enemy: { ...enemy, maxHp: enemy.hp },
      log: arrayUnion(`Un ${enemy.name} surge de las sombras!`)
    });
    setHand(hero.deck.sort(() => Math.random() - 0.5).slice(0, 4));
    setMana(hero.mana);
  };

  const playCard = async (card: Card) => {
    if (mana < card.cost || !session?.enemy) return;

    let updatedEnemy = { ...session.enemy };
    let msg = "";

    if (card.type === 'Attack') {
      updatedEnemy.hp = Math.max(0, updatedEnemy.hp - card.value);
      msg = `Atacas al enemigo con ${card.name} causando ${card.value} de daño.`;
    } else if (card.type === 'Heal') {
      setHp(h => Math.min(hero.maxHp, h + card.value));
      msg = `Usas ${card.name} y recuperas ${card.value} de vida.`;
    }

    setMana(m => m - card.cost);
    setHand(h => h.filter(c => c !== card));

    if (updatedEnemy.hp === 0) {
      await updateDoc(doc(db, 'raids', raidId), {
        status: 'victory',
        enemy: null,
        log: arrayUnion(msg + " ¡El enemigo ha sido derrotado!")
      });
    } else {
      await updateDoc(doc(db, 'raids', raidId), {
        enemy: updatedEnemy,
        log: arrayUnion(msg)
      });
    }
  };

  const endTurn = async () => {
    if (!session?.enemy) return;
    const dmg = session.enemy.damage;
    setHp(h => Math.max(0, h - dmg));
    setMana(hero.mana);
    setHand(hero.deck.sort(() => Math.random() - 0.5).slice(0, 4));
    await updateDoc(doc(db, 'raids', raidId), {
      log: arrayUnion(`El enemigo contraataca infligiendo ${dmg} de daño!`)
    });
  };

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 p-4">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-4 shadow-xl">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Vida</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(hp/hero.maxHp)*100}%` }}></div>
              </div>
              <span className="text-xs font-bold text-red-400">{hp}/{hero.maxHp}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Energía</span>
            <div className="flex gap-1 mt-1">
              {[...Array(hero.mana)].map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < mana ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800 opacity-20'}`}></div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onLeave} className="text-xs text-slate-500 hover:text-red-400 font-bold uppercase transition-colors">Retirada</button>
      </div>

      <div className="flex-grow flex gap-4 overflow-hidden">
        <div className="flex-grow bg-slate-900/40 rounded-3xl border border-slate-800 relative flex flex-col items-center justify-center p-8 backdrop-blur-sm shadow-inner text-white">
          {session.status === 'lobby' && (
            <div className="text-center animate-fade-in">
              <div className="w-24 h-24 bg-amber-600/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-amber-600/20">
                <i className="fa-solid fa-dungeon text-4xl text-amber-600"></i>
              </div>
              <h2 className="text-3xl fantasy-font mb-6">Frente a la Mazmorra</h2>
              <button onClick={startCombat} className="bg-amber-600 hover:bg-amber-500 px-12 py-4 rounded-2xl text-xl fantasy-font shadow-lg transition-transform active:scale-95 text-white">DESCENDER</button>
            </div>
          )}

          {session.status === 'combat' && session.enemy && (
            <div className="text-center animate-fade-in flex flex-col items-center">
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-red-600/10 blur-3xl animate-pulse rounded-full"></div>
                <div className="w-48 h-48 rounded-3xl border-4 border-slate-800 relative z-10 bg-slate-800 flex items-center justify-center shadow-2xl">
                  <i className={`fa-solid ${session.enemy.icon} text-7xl text-red-600`}></i>
                </div>
              </div>
              <h3 className="text-2xl text-red-500 fantasy-font mb-4 uppercase tracking-widest">{session.enemy.name}</h3>
              <div className="w-64 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-red-600 transition-all duration-700" style={{ width: `${(session.enemy.hp / session.enemy.maxHp) * 100}%` }}></div>
              </div>
              <p className="mt-4 text-slate-500 text-sm font-bold">Daño Enemigo: {session.enemy.damage}</p>
            </div>
          )}

          {session.status === 'victory' && (
            <div className="text-center animate-fade-in">
              <h2 className="text-5xl fantasy-font text-amber-500 mb-8">¡VICTORIA!</h2>
              <button onClick={() => updateDoc(doc(db, 'raids', raidId), { status: 'lobby' })} className="bg-slate-800 border border-amber-600/50 px-8 py-3 rounded-xl hover:bg-amber-600 transition-all font-bold">VOLVER AL CAMPAMENTO</button>
            </div>
          )}
        </div>

        <div className="w-80 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col shadow-2xl">
          <h3 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-4">Bitácora</h3>
          <div className="flex-grow overflow-y-auto space-y-2 pr-2 text-sm">
            {session.log.slice().reverse().map((m: string, i: number) => (
              <div key={i} className="p-3 bg-slate-800/30 rounded-xl border-l-2 border-amber-600/20 text-slate-400 italic leading-snug">
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-64 mt-4 flex gap-4">
        <div className="flex-grow flex justify-center items-center gap-4 bg-slate-900/20 rounded-3xl border border-slate-800/30 px-8">
          {hand.map((card, idx) => (
            <div key={`${card.id}-${idx}`} onClick={() => playCard(card)} className={`w-36 h-48 bg-slate-800 border-2 rounded-2xl p-4 flex flex-col card-glow cursor-pointer relative ${mana < card.cost ? 'opacity-40 grayscale cursor-not-allowed disabled border-slate-700' : 'border-slate-700 hover:border-amber-600'}`}>
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-black border-2 border-slate-900 shadow-lg text-white">{card.cost}</div>
              <i className={`fa-solid ${card.icon} text-3xl text-amber-500 mx-auto my-4`}></i>
              <p className="text-[11px] font-black text-center mb-1 text-white">{card.name}</p>
              <p className="text-[9px] text-slate-400 text-center flex-grow italic">"{card.desc}"</p>
              <div className={`text-[9px] font-black text-center p-1 rounded ${card.type === 'Attack' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                {card.type} ({card.value})
              </div>
            </div>
          ))}
          {hand.length === 0 && session.status === 'combat' && (
            <div className="text-slate-800 fantasy-font text-2xl opacity-20">SIN CARTAS</div>
          )}
        </div>
        <button onClick={endTurn} disabled={session.status !== 'combat'} className="w-48 bg-slate-900 border-2 border-slate-800 hover:border-amber-600 hover:bg-amber-600/10 rounded-3xl transition-all font-black fantasy-font flex flex-col items-center justify-center gap-3 group disabled:opacity-20 text-white">
          <i className="fa-solid fa-hourglass-end text-2xl group-hover:rotate-12 transition-transform"></i>
          <span className="text-xs tracking-widest">PASAR TURNO</span>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [raidId, setRaidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docRef = doc(db, 'users', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) setHero(snap.data() as Hero);
      } else {
        setUser(null);
        setHero(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-amber-500 fantasy-font text-2xl animate-pulse">CARGANDO REINO...</div>;

  if (!user) return <AuthScreen />;
  if (!hero) return <HeroSelection user={user} onCreated={setHero} />;
  if (!raidId) return <Lobby hero={hero} onJoin={setRaidId} />;

  return <GameBoard raidId={raidId} hero={hero} onLeave={() => setRaidId(null)} />;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
