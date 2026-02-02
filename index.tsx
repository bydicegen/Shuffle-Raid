import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
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
  campaignProgress: number;
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
  { name: "Esqueleto Reanimado", hp: 40, damage: 6, icon: 'fa-skeleton' },
  { name: "Espectro del Vacío", hp: 60, damage: 10, icon: 'fa-ghost' },
  { name: "Sabueso Infernal", hp: 50, damage: 12, icon: 'fa-dog' },
  { name: "Caudillo Orco", hp: 100, damage: 15, icon: 'fa-user-ninja' }
];

// --- COMPONENTES ---

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

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) { 
      if (err.code !== 'auth/popup-closed-by-user') {
        alert(err.message); 
      }
    }
    finally { setAuthLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 animate-fade-in relative">
        {authLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
             <div className="text-amber-600 fantasy-font text-xl animate-bounce tracking-widest">ENTRANDO...</div>
          </div>
        )}
        
        <h1 className="text-5xl fantasy-font text-slate-900 text-center mb-2 uppercase tracking-tight">Shuffle Raid</h1>
        <p className="text-slate-500 text-center mb-10 uppercase tracking-[0.3em] text-[10px] font-black">Un RPG de cartas por turnos</p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email del aventurero" 
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 transition-all text-slate-900 placeholder:text-slate-400 font-bold text-sm shadow-sm" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Contraseña secreta" 
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 transition-all text-slate-900 placeholder:text-slate-400 font-bold text-sm shadow-sm" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 uppercase text-[10px]">
            <i className={isReg ? "fa-solid fa-user-plus" : "fa-solid fa-key"}></i>
            {isReg ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="flex-grow h-px bg-slate-100"></div>
          <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest">O</span>
          <div className="flex-grow h-px bg-slate-100"></div>
        </div>

        <button 
          onClick={handleGoogleAuth}
          className="w-full bg-white text-slate-700 py-4 rounded-2xl font-black border border-slate-100 hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" alt="Google" />
          CONTINUAR CON GOOGLE
        </button>

        <button onClick={() => setIsReg(!isReg)} className="w-full mt-8 text-slate-400 text-xs hover:text-amber-500 transition-colors font-black tracking-widest uppercase">
          {isReg ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo? Crea tu cuenta'}
        </button>

        <div className="mt-12 flex justify-center">
          <a 
            href="https://www.instagram.com/shuffle_raid" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-300 hover:text-pink-600 transition-colors font-black text-[9px] tracking-[0.3em] uppercase"
          >
            <i className="fa-brands fa-instagram text-lg"></i>
            Instagram
          </a>
        </div>
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
      deck: config.deck,
      campaignProgress: 1
    };
    await setDoc(doc(db, 'users', user.uid), newHero);
    onCreated(newHero);
  };

  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center">
      <h2 className="text-4xl text-slate-900 fantasy-font mb-2 animate-fade-in text-center uppercase tracking-tighter">Bienvenido, {user.displayName || 'Héroe'}</h2>
      <p className="text-slate-400 mb-16 animate-fade-in uppercase tracking-[0.3em] text-[10px] font-black">Escoge tu legado</p>
      <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl">
        {Object.keys(CLASSES).map(type => (
          <div key={type} onClick={() => handleSelect(type)} className="bg-white border-2 border-slate-50 rounded-3xl p-10 hover:border-amber-500 cursor-pointer transition-all group flex flex-col items-center shadow-sm hover:shadow-2xl">
            <div className="text-7xl text-slate-900 mb-8 group-hover:scale-110 transition-transform group-hover:text-amber-500 duration-500"><i className={`fa-solid ${CLASSES[type].icon}`}></i></div>
            <h3 className="text-2xl text-slate-800 fantasy-font mb-6 uppercase tracking-widest">{type}</h3>
            <div className="flex justify-between w-full text-[10px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-50 uppercase tracking-[0.2em]">
              <span className="text-red-500">Vida: {CLASSES[type].hp}</span>
              <span className="text-blue-500">Energía: {CLASSES[type].mana}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameModeMenu({ hero, onModeSelect }: { hero: Hero, onModeSelect: (mode: string) => void }) {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center max-w-6xl mx-auto">
      <h1 className="text-5xl text-slate-900 fantasy-font mb-2 uppercase tracking-tighter">Shuffle Raid</h1>
      <p className="text-slate-300 mb-20 tracking-[0.5em] uppercase text-[10px] font-black">Menú Principal</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 w-full">
        {/* MODO CAMPAÑA */}
        <div 
          onClick={() => onModeSelect('campaign')}
          className="group relative h-96 bg-slate-50 rounded-[2.5rem] overflow-hidden cursor-pointer border border-slate-100 hover:border-amber-500 transition-all shadow-sm hover:shadow-2xl flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
            <i className="fa-solid fa-scroll text-3xl text-slate-800 group-hover:text-amber-500"></i>
          </div>
          <h2 className="text-2xl fantasy-font text-slate-900 mb-3 uppercase tracking-widest">Campaña</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose max-w-[200px]">Sigue la historia y descubre el Lore antiguo de los reinos.</p>
        </div>

        {/* MODO INDIVIDUAL */}
        <div 
          onClick={() => onModeSelect('individual')}
          className="group relative h-96 bg-slate-50 rounded-[2.5rem] overflow-hidden cursor-pointer border border-slate-100 hover:border-blue-500 transition-all shadow-sm hover:shadow-2xl flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
            <i className="fa-solid fa-user-ninja text-3xl text-slate-800 group-hover:text-blue-500"></i>
          </div>
          <h2 className="text-2xl fantasy-font text-slate-900 mb-3 uppercase tracking-widest">Individual</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose max-w-[200px]">Perfecciona tus habilidades contra la oscuridad.</p>
        </div>

        {/* MODO MULTIJUGADOR */}
        <div 
          onClick={() => onModeSelect('multiplayer')}
          className="group relative h-96 bg-slate-50 rounded-[2.5rem] overflow-hidden cursor-pointer border border-slate-100 hover:border-red-500 transition-all shadow-sm hover:shadow-2xl flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
            <i className="fa-solid fa-users-rays text-3xl text-slate-800 group-hover:text-red-500"></i>
          </div>
          <h2 className="text-2xl fantasy-font text-slate-900 mb-3 uppercase tracking-widest">Multi</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose max-w-[200px]">Únete a otros aventureros y asalta las mazmorras.</p>
        </div>
      </div>

      <button onClick={() => signOut(auth)} className="mt-20 text-slate-300 hover:text-red-500 font-black uppercase tracking-[0.4em] text-[9px] transition-colors flex items-center gap-2">
        <i className="fa-solid fa-power-off"></i> CERRAR SESIÓN
      </button>
    </div>
  );
}

function SubMenuLayout({ title, subtitle, onBack, children }: { title: string, subtitle: string, onBack: () => void, children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center max-w-4xl mx-auto">
      <button onClick={onBack} className="self-start mb-12 text-slate-300 hover:text-slate-900 flex items-center gap-3 font-black text-[9px] tracking-[0.3em] uppercase transition-all">
        <i className="fa-solid fa-arrow-left text-sm"></i> VOLVER
      </button>
      <h1 className="text-4xl text-slate-900 fantasy-font mb-2 uppercase tracking-tighter">{title}</h1>
      <p className="text-slate-300 mb-16 tracking-[0.3em] uppercase text-[10px] font-black">{subtitle}</p>
      {children}
    </div>
  );
}

function DifficultySelector({ options, onSelect }: { options: string[], onSelect: (opt: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
      {options.map(opt => (
        <button 
          key={opt}
          onClick={() => onSelect(opt)}
          className="bg-white border-2 border-slate-50 p-8 rounded-[2rem] text-[10px] font-black text-slate-800 hover:border-amber-500 hover:bg-slate-50 transition-all active:scale-95 shadow-sm uppercase tracking-[0.3em]"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function CampaignMode({ hero, onBack }: { hero: Hero, onBack: () => void }) {
  return (
    <SubMenuLayout title="Campaña" subtitle="El Despertar de los Reinos" onBack={onBack}>
      <div className="w-full max-w-lg bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
        <div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 flex items-center justify-center text-4xl text-amber-500 fantasy-font mb-6 shadow-sm">
          {hero.campaignProgress}
        </div>
        <h2 className="text-xl text-slate-900 fantasy-font uppercase tracking-widest mb-2">TIER {hero.campaignProgress}</h2>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] mb-10">Progreso del Aventurero</p>
        
        <div className="space-y-4 w-full">
           <button className="w-full bg-slate-900 py-5 rounded-2xl font-black text-white hover:bg-slate-800 shadow-xl transition-all text-[10px] tracking-[0.3em] uppercase">CONTINUAR HISTORIA</button>
           <button className="w-full bg-white border border-slate-100 py-5 rounded-2xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all text-[10px] tracking-[0.3em] uppercase shadow-sm">COLECCIÓN DE LORE</button>
        </div>
      </div>
    </SubMenuLayout>
  );
}

function IndividualMode({ onBack, onStartGame }: { onBack: () => void, onStartGame: (diff: string) => void }) {
  return (
    <SubMenuLayout title="Individual" subtitle="Entrenamiento" onBack={onBack}>
      <DifficultySelector 
        options={['Fácil', 'Normal', 'Difícil', 'Modo Infinito']} 
        onSelect={onStartGame} 
      />
    </SubMenuLayout>
  );
}

function MultiplayerMode({ onBack, onStartRaid }: { onBack: () => void, onStartRaid: (config: any) => void }) {
  const [step, setStep] = useState<'difficulty' | 'matchType' | 'partySize'>('difficulty');
  const [selectedDiff, setSelectedDiff] = useState('');

  if (step === 'difficulty') {
    return (
      <SubMenuLayout title="Multijugador" subtitle="Dificultad de la Raid" onBack={onBack}>
        <DifficultySelector 
          options={['Normal', 'Difícil', 'Modo Infinito']} 
          onSelect={(d) => { setSelectedDiff(d); setStep('matchType'); }} 
        />
      </SubMenuLayout>
    );
  }

  if (step === 'matchType') {
    return (
      <SubMenuLayout title="Selección" subtitle={`${selectedDiff} - Modo`} onBack={() => setStep('difficulty')}>
        <div className="grid grid-cols-1 gap-6 w-full">
          <button 
            onClick={() => setStep('partySize')}
            className="bg-slate-900 p-10 rounded-[2.5rem] flex items-center justify-between group hover:bg-slate-800 transition-all text-white shadow-2xl"
          >
            <div className="text-left">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-1">Partida Rápida</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Unirse a héroes online</p>
            </div>
            <i className="fa-solid fa-bolt text-2xl text-amber-500 group-hover:scale-125 transition-transform"></i>
          </button>
          
          <button 
            onClick={() => onStartRaid({ type: 'friends', difficulty: selectedDiff, size: 4 })}
            className="bg-white border-2 border-slate-50 p-10 rounded-[2.5rem] flex items-center justify-between group hover:border-red-500 transition-all text-slate-900 shadow-sm"
          >
            <div className="text-left">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-1">Con Amigos</h3>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Grupo privado (Hasta 4)</p>
            </div>
            <i className="fa-solid fa-heart text-2xl text-red-500 group-hover:scale-125 transition-transform"></i>
          </button>
        </div>
      </SubMenuLayout>
    );
  }

  return (
    <SubMenuLayout title="Matchmaking" subtitle="Tamaño del Grupo" onBack={() => setStep('matchType')}>
      <div className="grid grid-cols-2 gap-6 w-full">
        <button 
          onClick={() => onStartRaid({ type: 'quick', difficulty: selectedDiff, size: 2 })}
          className="bg-white border-2 border-slate-50 p-12 rounded-[3rem] flex flex-col items-center gap-6 hover:border-blue-500 transition-all text-slate-900 shadow-sm group"
        >
          <span className="text-5xl font-black fantasy-font group-hover:scale-110 transition-transform">2</span>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">HÉROES</span>
        </button>
        <button 
          onClick={() => onStartRaid({ type: 'quick', difficulty: selectedDiff, size: 3 })}
          className="bg-white border-2 border-slate-50 p-12 rounded-[3rem] flex flex-col items-center gap-6 hover:border-blue-500 transition-all text-slate-900 shadow-sm group"
        >
          <span className="text-5xl font-black fantasy-font group-hover:scale-110 transition-transform">3</span>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">HÉROES</span>
        </button>
      </div>
    </SubMenuLayout>
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
      msg = `Atacas con ${card.name} causando ${card.value} de daño.`;
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
      log: arrayUnion(`¡El enemigo contraataca infligiendo ${dmg} de daño!`)
    });
  };

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white p-6">
      {/* HEADER LIMPIO */}
      <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-5 rounded-[2rem] mb-6 shadow-sm">
        <div className="flex gap-10">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-300 uppercase font-black tracking-[0.3em]">Vida</span>
            <div className="flex items-center gap-3">
              <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-700 ease-out" style={{ width: `${(hp/hero.maxHp)*100}%` }}></div>
              </div>
              <span className="text-[10px] font-black text-slate-900 tracking-widest">{hp}/{hero.maxHp}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-300 uppercase font-black tracking-[0.3em]">Energía</span>
            <div className="flex gap-2 mt-2">
              {[...Array(hero.mana)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${i < mana ? 'bg-blue-500 shadow-md' : 'bg-slate-200'}`}></div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] bg-white px-4 py-2 rounded-2xl border border-slate-100">
             SALA: {session.id.slice(-6).toUpperCase()}
           </div>
           <button onClick={onLeave} className="text-[9px] text-slate-300 hover:text-red-500 font-black uppercase tracking-[0.3em] transition-all">RETIRADA</button>
        </div>
      </div>

      <div className="flex-grow flex gap-6 overflow-hidden">
        {/* TABLERO */}
        <div className="flex-grow bg-slate-50 rounded-[3.5rem] border border-slate-100 relative flex flex-col items-center justify-center p-10 shadow-inner overflow-hidden">
          {session.status === 'lobby' && (
            <div className="text-center animate-fade-in flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-8 shadow-sm border border-slate-100">
                <i className="fa-solid fa-dungeon text-4xl text-slate-800"></i>
              </div>
              <h2 className="text-3xl fantasy-font mb-2 text-slate-900 uppercase tracking-tighter">Entrada de la Raid</h2>
              <p className="text-slate-400 mb-10 uppercase tracking-[0.4em] text-[9px] font-black italic">Aventureros en espera: {Object.keys(session.players).length}</p>
              <button onClick={startCombat} className="bg-slate-900 hover:bg-slate-800 px-16 py-5 rounded-[2rem] text-[10px] font-black tracking-[0.4em] shadow-2xl transition-all active:scale-95 text-white uppercase">INICIAR ASALTO</button>
            </div>
          )}

          {session.status === 'combat' && session.enemy && (
            <div className="text-center animate-fade-in flex flex-col items-center w-full max-w-lg">
              <div className="relative mb-12">
                 <div className="absolute inset-0 bg-slate-200 blur-3xl opacity-20 animate-pulse rounded-full"></div>
                 <div className="w-56 h-56 rounded-full border border-slate-100 relative z-10 bg-white flex items-center justify-center shadow-sm">
                   <i className={`fa-solid ${session.enemy.icon} text-8xl text-slate-800`}></i>
                 </div>
              </div>
              <h3 className="text-2xl text-slate-900 fantasy-font mb-4 uppercase tracking-[0.3em]">{session.enemy.name}</h3>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-slate-900 transition-all duration-1000 ease-in-out" style={{ width: `${(session.enemy.hp / session.enemy.maxHp) * 100}%` }}></div>
              </div>
              <div className="flex justify-between w-full text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">
                <span>VIDA ENEMIGO</span>
                <span className="text-slate-900">{session.enemy.hp} HP</span>
              </div>
            </div>
          )}

          {session.status === 'victory' && (
            <div className="text-center animate-fade-in">
              <h2 className="text-6xl fantasy-font text-amber-500 mb-10 uppercase tracking-tighter">Victoria</h2>
              <button onClick={() => updateDoc(doc(db, 'raids', raidId), { status: 'lobby' })} className="bg-slate-900 border border-slate-800 px-12 py-5 rounded-[2rem] hover:bg-slate-800 transition-all font-black text-white text-[10px] tracking-[0.4em] uppercase shadow-2xl">REGRESAR AL CAMPAMENTO</button>
            </div>
          )}
        </div>

        {/* LOG */}
        <div className="w-80 bg-white border border-slate-100 rounded-[3rem] p-8 flex flex-col shadow-sm">
          <h3 className="text-[9px] uppercase font-black text-slate-300 tracking-[0.4em] mb-6 text-center border-b border-slate-50 pb-4">CRÓNICA DE GUERRA</h3>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2 text-[10px] mt-2 font-bold leading-relaxed text-slate-400">
            {session.log.slice().reverse().map((m: string, i: number) => (
              <div key={i} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-slate-200 transition-all hover:bg-white hover:shadow-sm">
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MANO */}
      <div className="h-72 mt-6 flex gap-6">
        <div className="flex-grow flex justify-center items-center gap-6 bg-slate-50 rounded-[3.5rem] border border-slate-100 px-10 overflow-x-auto shadow-inner">
          {hand.map((card, idx) => (
            <div key={`${card.id}-${idx}`} onClick={() => playCard(card)} className={`w-40 h-56 bg-white border border-slate-100 rounded-[2rem] p-6 flex-shrink-0 flex flex-col card-glow cursor-pointer relative shadow-sm ${mana < card.cost ? 'opacity-20 grayscale' : 'hover:border-amber-400'}`}>
              <div className="absolute -top-3 -left-3 w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-[10px] font-black border-4 border-white shadow-md text-white">{card.cost}</div>
              <i className={`fa-solid ${card.icon} text-3xl text-slate-700 mx-auto my-6`}></i>
              <p className="text-[10px] font-black text-center mb-2 text-slate-900 uppercase tracking-widest">{card.name}</p>
              <p className="text-[9px] text-slate-400 text-center flex-grow italic leading-relaxed uppercase font-bold px-1">"{card.desc}"</p>
              <div className={`text-[8px] font-black text-center p-2 rounded-xl mt-3 uppercase tracking-widest ${card.type === 'Attack' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                {card.type} ({card.value})
              </div>
            </div>
          ))}
          {hand.length === 0 && session.status === 'combat' && (
            <div className="text-slate-200 fantasy-font text-3xl uppercase tracking-[0.3em] opacity-30 select-none">Sin Cartas</div>
          )}
        </div>
        
        <button 
          onClick={endTurn} 
          disabled={session.status !== 'combat'} 
          className="w-56 bg-slate-900 border-2 border-slate-900 hover:bg-slate-800 rounded-[3rem] transition-all font-black fantasy-font flex flex-col items-center justify-center gap-4 group disabled:opacity-10 text-white shadow-2xl active:scale-95"
        >
          <i className="fa-solid fa-hourglass-end text-3xl group-hover:rotate-12 transition-transform text-amber-500"></i>
          <span className="text-[10px] tracking-[0.4em] uppercase">FIN TURNO</span>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [view, setView] = useState<'menu' | 'campaign' | 'individual' | 'multiplayer' | 'game'>('menu');
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

  const createRaid = async (config: any) => {
    if (!hero) return;
    const docRef = await addDoc(collection(db, 'raids'), {
      hostId: hero.uid,
      players: { [hero.uid]: { classType: hero.classType, level: hero.level } },
      status: 'lobby',
      difficulty: config.difficulty,
      maxPlayers: config.size,
      type: config.type,
      log: [`${hero.classType} ha iniciado el asalto.`]
    });
    setRaidId(docRef.id);
    setView('game');
  };

  const startIndividual = async (diff: string) => {
     await createRaid({ difficulty: diff, size: 1, type: 'individual' });
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-slate-200 fantasy-font text-2xl animate-pulse tracking-[0.5em] uppercase">Cargando Reino</div>;

  if (!user) return <AuthScreen />;
  if (!hero) return <HeroSelection user={user} onCreated={setHero} />;

  if (raidId) return <GameBoard raidId={raidId} hero={hero} onLeave={() => { setRaidId(null); setView('menu'); }} />;

  switch (view) {
    case 'menu': return <GameModeMenu hero={hero} onModeSelect={(m: any) => setView(m)} />;
    case 'campaign': return <CampaignMode hero={hero} onBack={() => setView('menu')} />;
    case 'individual': return <IndividualMode onBack={() => setView('menu')} onStartGame={startIndividual} />;
    case 'multiplayer': return <MultiplayerMode onBack={() => setView('menu')} onStartRaid={createRaid} />;
    default: return <GameModeMenu hero={hero} onModeSelect={(m: any) => setView(m)} />;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}