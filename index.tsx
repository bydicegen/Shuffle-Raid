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
  GoogleAuthProvider, 
  signInWithPopup, 
  type User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  arrayUnion 
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
  mode: string;
  difficulty: string;
  raidDeckSize: number;
}

// --- CONSTANTES ---
const CLASSES: Record<string, any> = {
  Warrior: {
    hp: 15, def: 2, baseAtk: 3, icon: 'fa-shield-halved',
    abilities: [
      { id: 'base', name: 'Golpe', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque físico básico.', icon: 'fa-hand-fist' },
      { id: 'offense', name: 'Ataque Fuerte', type: 'Attack', cost: 3, cooldown: 2, desc: '6 de daño físico.', icon: 'fa-sword' },
      { id: 'support', name: 'Intervenir', type: 'Support', cost: 2, cooldown: 2, desc: 'Protege a un aliado.', icon: 'fa-shield-heart' }
    ]
  },
  Mage: {
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-wand-sparkles',
    abilities: [
      { id: 'base', name: 'Centella', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque mágico básico.', icon: 'fa-sparkles' },
      { id: 'offense', name: 'Incinerar', type: 'Attack', cost: 3, cooldown: 2, desc: 'Daño y quemadura.', icon: 'fa-fire' },
      { id: 'support', name: 'Escudo Mágico', type: 'Support', cost: 2, cooldown: 2, desc: 'Absorbe 2 de daño.', icon: 'fa-shield-halved' }
    ]
  },
  Hunter: {
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-crosshairs',
    abilities: [
      { id: 'base', name: 'Flecha', type: 'Basic', cost: 1, cooldown: 0, desc: 'Ataque físico básico.', icon: 'fa-location-arrow' },
      { id: 'offense', name: 'Disparo Múltiple', type: 'Attack', cost: 3, cooldown: 2, desc: '2 flechas de 2 daño.', icon: 'fa-arrows-to-eye' },
      { id: 'support', name: 'Distracción', type: 'Support', cost: 2, cooldown: 2, desc: 'Evita ataque (D20: 6+).', icon: 'fa-bullseye' }
    ]
  }
};

const ENEMIES = [
  { name: "Esqueleto", hp: 12, damage: 2, icon: 'fa-skeleton' },
  { name: "Espectro", hp: 10, damage: 3, icon: 'fa-ghost' },
  { name: "Lobo Abisal", hp: 8, damage: 4, icon: 'fa-dog' },
  { name: "Minotauro", hp: 20, damage: 5, icon: 'fa-vihara' }
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
        <p className="text-slate-400 mb-12 uppercase tracking-[0.4em] text-[10px] font-black">Forja tu Leyenda</p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" 
            placeholder="EMAIL" 
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 transition-all font-bold text-xs shadow-sm" 
            value={email} onChange={e => setEmail(e.target.value)} required 
          />
          <input 
            type="password" 
            placeholder="PASSWORD" 
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 transition-all font-bold text-xs shadow-sm" 
            value={password} onChange={e => setPassword(e.target.value)} required 
          />
          <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg uppercase text-[10px]">
            {authLoading ? 'CONECTANDO...' : (isReg ? 'CREAR CUENTA' : 'ENTRAR AL REINO')}
          </button>
        </form>
        <button onClick={() => setIsReg(!isReg)} className="mt-8 text-slate-400 text-[9px] font-black tracking-widest uppercase">
          {isReg ? 'YA TENGO UN HÉROE' : 'NUEVO HÉROE'}
        </button>
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
    const unsubscribe = onSnapshot(doc(db, 'raids', raidId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      const data = snap.data();
      setSession({ id: snap.id, ...data });
      if (data.log) setLog(data.log);
    });
    return unsubscribe;
  }, [raidId]);

  const getGeminiNarration = async (heroClass: string, abilityName: string, targetName: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `RPG narrativo: El ${heroClass} usa "${abilityName}" contra ${targetName}. Describe la acción en 12 palabras máximo en español épico.`,
      });
      return response.text;
    } catch (e) {
      return `¡El ${heroClass} desata su ${abilityName}!`;
    }
  };

  const drawEncounter = async () => {
    if (session.raidDeckRemaining === 0 && session.difficulty !== 'Infinito') {
      await updateDoc(doc(db, 'raids', raidId), { status: 'final_victory' });
      return;
    }

    const enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const newRemaining = session.difficulty === 'Infinito' ? 999 : Math.max(0, session.raidDeckRemaining - 1);
    
    await updateDoc(doc(db, 'raids', raidId), {
      status: 'combat',
      enemy: { ...enemy, maxHp: enemy.hp },
      raidDeckRemaining: newRemaining,
      log: arrayUnion(`¡Un ${enemy.name} bloquea el camino!`)
    });
  };

  const useAbility = async (ability: Ability) => {
    if (heroState.pa < ability.cost || (heroState.cooldowns[ability.id] || 0) > 0 || !session?.enemy || busy) return;
    setBusy(true);

    const narration = await getGeminiNarration(heroState.classType, ability.name, session.enemy.name);
    let damage = 0;
    let specialLog = "";

    if (ability.id === 'base') damage = heroState.baseAtk;
    if (ability.id === 'offense') {
      if (heroState.classType === 'Warrior') damage = 6;
      if (heroState.classType === 'Mage') { damage = 3; specialLog = " El enemigo arde..."; }
      if (heroState.classType === 'Hunter') damage = 4;
    }
    if (ability.id === 'support' && heroState.classType === 'Hunter') {
      const roll = Math.floor(Math.random() * 20) + 1;
      specialLog = ` D20: ${roll}. ${roll >= 6 ? "¡Éxito!" : "¡Falla!"}`;
    }

    const newEnemyHp = Math.max(0, session.enemy.hp - damage);
    
    setHeroState(prev => ({
      ...prev,
      pa: prev.pa - ability.cost,
      cooldowns: { ...prev.cooldowns, [ability.id]: ability.cooldown }
    }));

    if (newEnemyHp === 0) {
      await updateDoc(doc(db, 'raids', raidId), {
        status: 'victory',
        enemy: null,
        log: arrayUnion(`${narration}${specialLog}`, `¡El ${session.enemy.name} sucumbe!`)
      });
    } else {
      await updateDoc(doc(db, 'raids', raidId), {
        'enemy.hp': newEnemyHp,
        log: arrayUnion(`${narration}${specialLog}`)
      });
    }
    setBusy(false);
  };

  const endTurn = async () => {
    if (!session?.enemy || busy) return;
    setBusy(true);

    const enemyDamage = Math.max(1, session.enemy.damage - heroState.def);
    const newHeroHp = Math.max(0, heroState.hp - enemyDamage);

    const newCooldowns = { ...heroState.cooldowns };
    Object.keys(newCooldowns).forEach(key => {
      if (newCooldowns[key] > 0) newCooldowns[key] -= 1;
    });

    setHeroState(prev => ({
      ...prev,
      hp: newHeroHp,
      pa: 5,
      cooldowns: newCooldowns
    }));

    await updateDoc(doc(db, 'raids', raidId), {
      log: arrayUnion(`Contraataque: Recibes ${enemyDamage} daño.`)
    });
    setBusy(false);
  };

  if (session?.status === 'final_victory' || heroState.hp <= 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-6 text-center animate-fade-in">
        <h1 className={`text-6xl fantasy-font mb-4 ${heroState.hp <= 0 ? 'text-red-600' : 'text-amber-500'}`}>
          {heroState.hp <= 0 ? 'CAÍDO' : 'CONQUISTADO'}
        </h1>
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] mb-12">
          {heroState.hp <= 0 ? 'Tu leyenda termina aquí' : 'Has superado la oscuridad'}
        </p>
        <button onClick={onLeave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">REGRESAR</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
             <i className={`fa-solid ${CLASSES[heroState.classType].icon}`}></i>
          </div>
          <div>
            <h2 className="text-[10px] fantasy-font font-black uppercase text-slate-900">{heroState.classType}</h2>
            <div className="flex gap-1">
              {[...Array(heroState.maxHp)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < heroState.hp ? 'bg-red-500' : 'bg-slate-100'}`}></div>
              ))}
            </div>
          </div>
        </div>
        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
           {session?.difficulty} • {session?.raidDeckRemaining} restantes
        </div>
      </div>

      <div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden">
        <div className="flex-grow bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col items-center justify-center relative p-6 shadow-inner">
          {session?.status === 'combat' && session.enemy ? (
            <div className="text-center animate-fade-in">
              <i className={`fa-solid ${session.enemy.icon} text-8xl text-slate-900 mb-6 drop-shadow-2xl`}></i>
              <h3 className="fantasy-font text-xl uppercase mb-2">{session.enemy.name}</h3>
              <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden mx-auto border border-white">
                <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(session.enemy.hp / session.enemy.maxHp) * 100}%` }}></div>
              </div>
            </div>
          ) : (
            <div onClick={drawEncounter} className="flex flex-col items-center cursor-pointer group">
              <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center text-amber-500 text-4xl shadow-2xl transition-transform group-hover:scale-110">
                <i className="fa-solid fa-skull"></i>
              </div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Toca para avanzar</p>
            </div>
          )}
        </div>

        <div className="h-28 bg-white rounded-3xl border border-slate-100 p-4 overflow-y-auto no-scrollbar">
          {log.slice().reverse().map((m, i) => (
            <p key={i} className="text-[9px] font-bold text-slate-500 mb-2 leading-relaxed border-l-2 border-amber-400 pl-3 italic">{m}</p>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-900 rounded-t-[40px] shadow-2xl">
        <div className="flex justify-between items-center mb-4 px-2">
           <span className="text-[9px] font-black text-white uppercase tracking-widest">ENERGÍA: {heroState.pa} PA</span>
           <div className="flex gap-1">
             {[...Array(5)].map((_, i) => (
               <div key={i} className={`w-3 h-3 rounded-sm rotate-45 border border-white/10 ${i < heroState.pa ? 'bg-amber-400' : 'bg-slate-700'}`}></div>
             ))}
           </div>
        </div>
        
        <div className="flex gap-3 h-28">
          {CLASSES[heroState.classType].abilities.map((ability: Ability) => {
            const cd = heroState.cooldowns[ability.id] || 0;
            const canAfford = heroState.pa >= ability.cost;
            const isCombat = session?.status === 'combat';
            return (
              <button 
                key={ability.id}
                onClick={() => useAbility(ability)}
                disabled={cd > 0 || !canAfford || !isCombat || busy}
                className="flex-grow bg-slate-800 rounded-3xl flex flex-col items-center justify-center p-2 relative ability-btn border border-white/5"
              >
                {cd > 0 && <div className="absolute inset-0 rounded-3xl cooldown-overlay text-xl">{cd}</div>}
                <i className={`fa-solid ${ability.icon} text-2xl text-amber-500 mb-2`}></i>
                <span className="text-[8px] font-black text-white uppercase truncate px-1">{ability.name}</span>
                <span className="text-[7px] font-bold text-slate-500">{ability.cost} PA</span>
              </button>
            );
          })}
          
          <button onClick={endTurn} disabled={!session?.enemy || busy} className="w-16 bg-white rounded-3xl flex flex-col items-center justify-center text-slate-900 ability-btn">
            <i className="fa-solid fa-hourglass-end text-xl mb-1"></i>
            <span className="text-[7px] font-black uppercase">Turno</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lobby' | 'campaign' | 'individual' | 'multi' | 'difficulty' | 'selection' | 'game'>('lobby');
  const [raidConfig, setRaidConfig] = useState<RaidConfig | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [raidId, setRaidId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const startSetup = (mode: string) => {
    setRaidConfig({ mode, difficulty: 'Normal', raidDeckSize: 15 });
    setView('difficulty');
  };

  const selectDifficulty = (diff: string, size: number) => {
    setRaidConfig(prev => prev ? ({ ...prev, difficulty: diff, raidDeckSize: size }) : null);
    setView('selection');
  };

  const finalizeGame = async (classType: string) => {
    if (!user || !raidConfig) return;
    const config = CLASSES[classType];
    const newHero: Hero = {
      uid: user.uid,
      classType: classType,
      hp: 15, maxHp: 15, def: config.def, pa: 5, maxPa: 5, baseAtk: config.baseAtk, cooldowns: {}
    };

    const docRef = await addDoc(collection(db, 'raids'), {
      hostId: user.uid,
      status: 'waiting',
      mode: raidConfig.mode,
      difficulty: raidConfig.difficulty,
      raidDeckRemaining: raidConfig.raidDeckSize,
      log: [`El ${classType} ha penetrado en la mazmorra.`],
      createdAt: new Date().getTime()
    });

    setHero(newHero);
    setRaidId(docRef.id);
    setView('game');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white fantasy-font text-2xl uppercase tracking-widest animate-pulse">Cargando Reino...</div>;
  if (!user) return <AuthScreen />;
  if (view === 'game' && raidId && hero) return <GameBoard raidId={raidId} hero={hero} onLeave={() => { setRaidId(null); setView('lobby'); }} />;

  switch (view) {
    case 'lobby':
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-6xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-16">Mesa de Rol v2.5</p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => setView('campaign')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all">CAMPAÑA</button>
            <button onClick={() => setView('individual')} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[28px] font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">INDIVIDUAL</button>
            <button onClick={() => setView('multi')} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[28px] font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">MULTI</button>
            <button onClick={() => signOut(auth)} className="mt-8 text-slate-300 py-4 font-black uppercase tracking-widest text-[8px]">CERRAR SESIÓN</button>
          </div>
        </div>
      );
    case 'campaign':
      return (
        <SubMenuLayout title="Campaña" subtitle="Capítulo 1: Las Ruinas" onBack={() => setView('lobby')}>
          <button onClick={() => startSetup('campaign')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl">INICIAR ACTO I</button>
        </SubMenuLayout>
      );
    case 'individual':
      return (
        <SubMenuLayout title="Individual" subtitle="Retos Solitarios" onBack={() => setView('lobby')}>
          <button onClick={() => startSetup('individual')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl">GENERAR RETO</button>
        </SubMenuLayout>
      );
    case 'multi':
      return (
        <SubMenuLayout title="Multijugador" subtitle="Partida de Gremio" onBack={() => setView('lobby')}>
          <button onClick={() => startSetup('multi')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl">BUSCAR PARTIDA</button>
        </SubMenuLayout>
      );
    case 'difficulty':
      return (
        <SubMenuLayout title="Dificultad" subtitle="Define el riesgo" onBack={() => setView('lobby')}>
          <DifficultySelector onSelect={selectDifficulty} />
        </SubMenuLayout>
      );
    case 'selection':
      return (
        <SubMenuLayout title="Tu Héroe" subtitle="Elige tu clase" onBack={() => setView('difficulty')}>
          {Object.keys(CLASSES).map(key => (
            <button key={key} onClick={() => finalizeGame(key)} className="w-full flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[28px] hover:border-amber-400 group active:scale-95 transition-all">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl group-hover:text-amber-400">
                <i className={`fa-solid ${CLASSES[key].icon}`}></i>
              </div>
              <div className="text-left flex-grow">
                <h3 className="fantasy-font text-sm text-slate-900 uppercase">{key}</h3>
                <p className="text-[7px] font-black text-slate-400 uppercase">HP: 15 • Def: {CLASSES[key].def}</p>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-amber-400"></i>
            </button>
          ))}
        </SubMenuLayout>
      );
    default:
      return null;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);