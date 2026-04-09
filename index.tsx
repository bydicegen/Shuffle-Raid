import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
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
  updateDoc, 
  arrayUnion,
  getDoc,
  setDoc,
  increment
} from "firebase/firestore";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDnfytB6714BdUUMRMD8RjB-VFxiRq-ShM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shuffle-raid-bf1c3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shuffle-raid-bf1c3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shuffle-raid-bf1c3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "471193527658",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:471193527658:web:cc8666660b7967975af113",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JWLQR80K84"
};

let auth: any;
let db: any;
let analytics: any;

try {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  isSupported().then(yes => {
    if (yes) analytics = getAnalytics(firebaseApp);
  });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

const safeUpdateDoc = async (docRef: any, data: any) => {
  try {
    await updateDoc(docRef, data);
  } catch (error: any) {
    console.error("Firestore update error:", error);
    if (error.message.includes("permissions")) {
      alert("Error de permisos: No tienes autorización para realizar esta acción. Asegúrate de que las reglas de Firestore permitan escritura en la colección 'matches'.");
    } else {
      alert("Error al actualizar datos: " + error.message);
    }
    throw error;
  }
};

const safeSetDoc = async (docRef: any, data: any) => {
  try {
    await setDoc(docRef, data);
  } catch (error: any) {
    console.error("Firestore setDoc error:", error);
    if (error.message.includes("permissions")) {
      alert("Error de permisos: No tienes autorización para crear este documento. Asegúrate de que las reglas de Firestore permitan 'create' en la colección 'matches'.");
    } else {
      alert("Error al guardar datos: " + error.message);
    }
    throw error;
  }
};

// --- CONFIGURACIÓN GEMINI ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- UTILIDADES ---
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const getExtraStats = (player: any) => {
  let extraPower = (player.extraAtk || 0);
  let extraDef = (player.extraDef || 0);
  let extraHp = (player.extraHp || 0);
  if (player?.equipment) {
    player.equipment.forEach((item: any) => {
      if (item) {
        extraPower += (item.power || 0);
        extraDef += (item.def || 0);
        extraHp += (item.hp || 0);
      }
    });
  }
  return { extraPower, extraDef, extraHp };
};

// --- SONIDOS ---
const SOUNDS = {
  ABILITY: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  DAMAGE: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  DEFEAT: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  TURN: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

const playSound = (url: string) => {
  try {
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignorar errores de autoplay
  } catch (e) {
    console.warn("Audio error:", e);
  }
};

// --- CONSTANTES ---
const CLASSES: Record<string, any> = {
  Warrior: { 
    hp: 20, def: 2, baseAtk: 3, icon: 'fa-shield-halved', color: 'amber',
    abilities: [
      { id: 'basic_atk', name: 'Ataque Básico', type: 'Attack', cost: 1, cooldown: 1, power: 3, icon: 'fa-sword', damageType: 'physical' },
      { id: 'strong_atk', name: 'Ataque Fuerte', type: 'Attack', cost: 3, cooldown: 2, power: 6, icon: 'fa-gavel', damageType: 'physical' },
      { id: 'intervene', name: 'Intervenir', type: 'Support', cost: 2, cooldown: 2, power: 0, desc: 'Recibe el próximo ataque por un aliado', icon: 'fa-handshake-angle' }
    ]
  },
  Mage: { 
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-wand-sparkles', color: 'blue',
    abilities: [
      { id: 'basic_atk', name: 'Ataque Básico', type: 'Attack', cost: 1, cooldown: 1, power: 3, icon: 'fa-sparkles', damageType: 'magic' },
      { id: 'incinerate', name: 'Incinerar', type: 'Attack', cost: 3, cooldown: 2, power: 3, desc: '2 dmg a todos o 3 dmg + quemadura', icon: 'fa-fire-flame-curved', damageType: 'magic' },
      { id: 'magic_shield', name: 'Escudo Mágico', type: 'Support', cost: 2, cooldown: 2, power: 2, desc: 'Escudo de 2 puntos', icon: 'fa-shield-heart' }
    ]
  },
  Hunter: { 
    hp: 15, def: 1, baseAtk: 3, icon: 'fa-crosshairs', color: 'emerald',
    abilities: [
      { id: 'basic_atk', name: 'Ataque Básico', type: 'Attack', cost: 1, cooldown: 1, power: 3, icon: 'fa-arrow-right', damageType: 'physical' },
      { id: 'multi_shot', name: 'Disparo Múltiple', type: 'Attack', cost: 3, cooldown: 2, power: 4, desc: '2 flechas de 2 daño c/u', icon: 'fa-arrows-to-dot', damageType: 'physical' },
      { id: 'distraction_shot', name: 'Disparo de Distracción', type: 'Support', cost: 2, cooldown: 2, power: 0, desc: 'Evita prox. ataque enemigo (Dado 6-20)', icon: 'fa-eye-slash' }
    ]
  }
};

const ENEMIES = [
  { 
    name: "Goblins", 
    isGroup: true,
    damagePerEntity: 2,
    entities: [
      { id: 0, name: "Goblin A", hp: 8, maxHp: 8 },
      { id: 1, name: "Goblin B", hp: 8, maxHp: 8 },
      { id: 2, name: "Goblin C", hp: 8, maxHp: 8 }
    ],
    hp: 24, maxHp: 24, damage: 6, def: 1, icon: 'fa-users-viewfinder', skillDesc: "Tres goblins que atacan al mismo objetivo. El daño se reduce al eliminar goblins.", requiresDice: false 
  },
  { name: "Ogro del Pantano", hp: 26, maxHp: 26, damage: 9, def: 1, icon: 'fa-hand-fist', skillDesc: "", requiresDice: false },
  { name: "Gólem Arcano", hp: 38, maxHp: 38, damage: 7, def: 1, icon: 'fa-mountain', skillDesc: "Piel de piedra impenetrable.", requiresDice: false },
  { name: "Lamía Seductora", hp: 30, maxHp: 30, damage: 6, def: 1, icon: 'fa-staff-snake', skillDesc: "Drenaje de esencia vital.", requiresDice: true },
  { name: "Fragmento de T'zel", hp: 50, maxHp: 50, damage: 0, def: 0, icon: 'fa-gem', skillDesc: "Cada 5 turnos inflige 10 de daño directo a todos los héroes.", requiresDice: false },
  { 
    name: "N'hamat", 
    isBoss: true,
    isGroup: true,
    entities: [
      { id: 'boss', name: "N'hamat", hp: 50, maxHp: 50, damage: 5, def: 1 }
    ],
    hp: 50, maxHp: 50, damage: 5, def: 1, icon: 'fa-skull-crossbones', 
    skillDesc: "Jefe Final. Cada 3 ataques exitosos invoca un súbdito (10 HP, 3 Atk). Comparten objetivo.", 
    requiresDice: false 
  }
];

const ITEMS = [
  { id: 'iron_sword', name: 'Espada de Hierro', type: 'Weapon', power: 1, icon: 'fa-sword' },
  { id: 'iron_armor', name: 'Armadura de Hierro', type: 'Armor', def: 1, icon: 'fa-shield' },
  { id: 'magic_talisman', name: 'Objeto Especial', type: 'Special', hp: 3, icon: 'fa-clover' },
  { id: 'health_potion', name: 'Poción de Curación', type: 'Usable', heal: 5, icon: 'fa-flask' },
];

const EQUIPMENT_SLOTS = [
  { id: 0, name: 'Arma', type: 'Weapon', icon: 'fa-sword' },
  { id: 1, name: 'Armadura', type: 'Armor', icon: 'fa-shield' },
  { id: 2, name: 'Especial', type: 'Special', icon: 'fa-shuriken' }
];

const getRewardItem = () => {
  const equippable = ITEMS.filter(i => ['Weapon', 'Armor', 'Special'].includes(i.type));
  return equippable[Math.floor(Math.random() * equippable.length)];
};

const GROUP_MISSIONS = [
  { id: 'kill_enemies', name: 'Eliminar 5 enemigos', target: 5, type: 'kill' },
  { id: 'overcome_events', name: 'Superar 2 cartas de eventos', target: 2, type: 'event' },
  { id: 'get_items', name: 'Conseguir 5 objetos equipables', target: 5, type: 'item' }
];

const INDIVIDUAL_MISSIONS = [
  { 
    id: 'last_hit', 
    name: 'Dar el último golpe a 4 enemigos', 
    type: 'last_hit', 
    target: 4, 
    reward: 'Ganas 1 punto de ataque', 
    penalty: 'Pierdes 1 punto de ataque' 
  },
  { 
    id: 'protect', 
    name: 'Evitar que un aliado reciba un total de 15 puntos de daño', 
    type: 'protect', 
    target: 15, 
    reward: 'Ganas 5 puntos de vida', 
    penalty: 'Tus puntos de vida máximos se reducen en 5' 
  },
  { 
    id: 'save_pa', 
    name: 'No gastar más de 20 PA', 
    type: 'save_pa', 
    target: 20, 
    reward: 'Tu límite de PA aumenta a 7', 
    penalty: 'Tu límite de PA se reduce en 1 punto' 
  }
];

const DIFFICULTY_CONFIG: Record<string, number> = {
  'Fácil': 10,
  'Normal': 15,
  'Difícil': 20,
  'Infinito': 999
};

// --- COMPONENTES ---

function SubMenuLayout({ title, subtitle, onBack, children }: { title: string, subtitle: string, onBack: () => void, children?: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white p-4 flex flex-col items-center justify-center animate-fade-in overflow-y-auto">
      <button onClick={onBack} className="self-start mb-4 text-slate-300 hover:text-slate-900 flex items-center gap-2 font-black text-[10px] tracking-[0.3em] uppercase transition-colors">
        <i className="fa-solid fa-arrow-left"></i> Volver
      </button>
      <h1 className="text-2xl text-slate-900 fantasy-font mb-1 uppercase tracking-tighter text-center">{title}</h1>
      <p className="text-slate-400 mb-6 tracking-[0.2em] uppercase text-[8px] font-black text-center">{subtitle}</p>
      <div className="w-full max-w-xs space-y-2">{children}</div>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isReg, setIsReg] = useState(false);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      alert("Error: Firebase no está inicializado. Verifica tu configuración.");
      return;
    }
    try {
      if (isReg) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center animate-fade-in">
      {!auth && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-[8px] font-black uppercase tracking-widest animate-pulse">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>
          Error de conexión
        </div>
      )}
      <h1 className="text-4xl fantasy-font text-slate-900 mb-1 uppercase tracking-tighter">SHUFFLE RAID</h1>
      <p className="text-slate-400 mb-8 uppercase tracking-[0.3em] text-[8px] font-black">Multiplayer RPG Edition</p>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-3">
        <input type="email" placeholder="EMAIL" className="w-full bg-slate-50 p-3 rounded-xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-[10px] shadow-sm" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-slate-50 p-3 rounded-xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-[10px] shadow-sm" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all">CONECTAR</button>
      </form>
      <button onClick={() => setIsReg(!isReg)} className="mt-6 text-slate-400 text-[8px] font-black tracking-widest uppercase">{isReg ? 'Tengo cuenta' : 'Nuevo héroe'}</button>
    </div>
  );
}

function LobbyWaiting({ matchId, user, onStart, onLeave }: { matchId: string, user: User, onStart: () => void, onLeave: () => void }) {
  const [match, setMatch] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    return onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      const data = snap.data();
      setMatch(data);
      if (data.status === 'combat') onStart();
    });
  }, [matchId]);

  if (!match) return null;

  const myPlayer = match.players.find((p: any) => p.uid === user.uid);
  const isHost = myPlayer?.role === 'host';
  const takenClasses = match.players.map((p: any) => p.classType).filter(Boolean);
  const allReady = match.players.every((p: any) => p.role === 'host' || p.isReady);

  const selectHero = async (classType: string) => {
    if (takenClasses.includes(classType) && myPlayer.classType !== classType) return;
    playSound(SOUNDS.CLICK);
    const updatedPlayers = match.players.map((p: any) => 
      p.uid === user.uid ? { ...p, classType, isReady: false, hp: CLASSES[classType].hp, pa: 6, cooldowns: {}, equipment: [null, null, null], inventory: [] } : p
    );
    await safeUpdateDoc(doc(db, 'matches', matchId), { players: updatedPlayers, sharedInventory: [ITEMS[3], ITEMS[3], ITEMS[3]] });
  };

  const toggleReady = async () => {
    if (!myPlayer.classType) return;
    playSound(SOUNDS.CLICK);
    const updatedPlayers = match.players.map((p: any) => 
      p.uid === user.uid ? { ...p, isReady: !p.isReady } : p
    );
    await safeUpdateDoc(doc(db, 'matches', matchId), { players: updatedPlayers });
  };

  const startCombat = async () => {
    if (!isHost || !allReady) return;
    playSound(SOUNDS.TURN);
    const initialDeckSize = DIFFICULTY_CONFIG[match.difficulty];
    const updatedPlayers = match.players.map((p: any) => {
      const mission = INDIVIDUAL_MISSIONS[Math.floor(Math.random() * INDIVIDUAL_MISSIONS.length)];
      return { 
        ...p, 
        ownerUid: p.uid,
        hp: CLASSES[p.classType].hp,
        maxHp: CLASSES[p.classType].hp,
        pa: 6,
        maxPa: 6,
        extraAtk: 0,
        shield: 0,
        intervenedBy: null,
        distracted: false,
        cooldowns: p.cooldowns || {},
        equipment: [null, null, null],
        bottomInventory: [],
        individualMission: {
          ...mission,
          progress: 0,
          status: 'active',
          deadlineCard: 5
        }
      };
    });
    const order = shuffleArray(updatedPlayers.map((p: any) => p.uid));
    await safeUpdateDoc(doc(db, 'matches', matchId), { 
      players: updatedPlayers,
      status: 'combat', 
      turnOrder: order, 
      activeTurnUid: order[0],
      phase: 'players',
      playersReadyForNext: [],
      alerts: []
    });
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    playSound(SOUNDS.CLICK);
    await updateDoc(doc(db, 'matches', matchId), {
      chat: arrayUnion({ user: user.email?.split('@')[0], text: msg, time: Date.now() })
    });
    setMsg('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={() => { playSound(SOUNDS.CLICK); onLeave(); }} 
          className="text-slate-300 font-black text-[8px] uppercase tracking-widest hover:text-red-500"
        >
          Salir
        </button>
        <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100 flex items-center gap-2">
           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Código</span>
           <span className="text-[10px] fantasy-font font-bold text-slate-900 tracking-wider">{matchId.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-4 overflow-hidden">
        <div className="space-y-2">
          {match.players.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 relative">
              <div className={`w-10 h-10 ${p.classType ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-200 text-slate-400'} rounded-xl flex items-center justify-center text-lg`}>
                <i className={`fa-solid ${p.classType ? CLASSES[p.classType].icon : 'fa-user-clock'}`}></i>
              </div>
              <div className="flex-grow">
                <p className="text-[9px] font-black uppercase text-slate-900">{p.name} {p.role === 'host' && '👑'}</p>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{p.classType || 'Eligiendo...'}</p>
              </div>
              {p.role !== 'host' && <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${p.isReady ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}><i className="fa-solid fa-check text-[8px]"></i></div>}
            </div>
          ))}
        </div>

        {!myPlayer?.isReady && (
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(CLASSES).map(key => {
              const isTaken = takenClasses.includes(key);
              const isMine = myPlayer.classType === key;
              return (
                <button key={key} onClick={() => selectHero(key)} disabled={isTaken && !isMine} className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all ${isMine ? 'bg-slate-900 border-slate-900 text-white scale-105 shadow-md' : (isTaken ? 'opacity-30 border-slate-100 grayscale cursor-not-allowed' : 'bg-white border-slate-100 text-slate-400 hover:border-amber-400')}`}>
                  <i className={`fa-solid ${CLASSES[key].icon} text-lg mb-1`}></i>
                  <span className="text-[6px] font-black uppercase mb-0.5">{key}</span>
                  <div className="flex gap-1.5 mt-1">
                    <div className="flex items-center gap-0.5" title="Ataque">
                      <i className="fa-solid fa-hand-fist text-orange-500 text-[5px]"></i>
                      <span className="text-[6px] font-black text-slate-400">{CLASSES[key].baseAtk}</span>
                    </div>
                    <div className="flex items-center gap-0.5" title="Defensa">
                      <i className="fa-solid fa-shield text-slate-400 text-[5px]"></i>
                      <span className="text-[6px] font-black text-slate-400">{CLASSES[key].def}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-grow bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col overflow-hidden shadow-inner p-3">
           <div className="flex-grow overflow-y-auto no-scrollbar space-y-2 p-1">
            {match.chat?.map((c: any, i: number) => (
              <div key={i} className={`flex flex-col ${c.user === user.email?.split('@')[0] ? 'items-end' : 'items-start'}`}>
                <div className="bg-white px-3 py-1.5 rounded-[14px] border border-slate-100 text-[9px] font-bold text-slate-700 shadow-sm max-w-[85%]">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input type="text" placeholder="Habla..." className="flex-grow bg-white px-3 py-2 rounded-lg text-[9px] outline-none border border-slate-100" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center"><i className="fa-solid fa-bolt text-[9px]"></i></button>
          </div>
        </div>

        <button 
          onClick={() => {
            playSound(SOUNDS.CLICK);
            isHost ? startCombat() : toggleReady();
          }} 
          disabled={!myPlayer.classType || (isHost && (!allReady || match.players.length < (match.mode === 'multi' ? 2 : 1)))} 
          className={`w-full py-4 rounded-[24px] font-black uppercase text-[9px] tracking-widest shadow-lg transition-all ${myPlayer.isReady || (isHost && allReady) ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white disabled:opacity-30'}`}
        >
          {isHost ? 'Empezar Incursión' : (myPlayer.isReady ? '¡Listo!' : 'Confirmar Héroe')}
        </button>
      </div>
    </div>
  );
}

function GameBoard({ matchId, user, onLeave }: { matchId: string, user: User, onLeave: () => void }) {
  const [match, setMatch] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [targeting, setTargeting] = useState<any>(null);
  const [animatingHero, setAnimatingHero] = useState<string | null>(null);
  const [hitHeroes, setHitHeroes] = useState<Record<string, boolean>>({});
  const [enemyHit, setEnemyHit] = useState(false);
  const [alertQueue, setAlertQueue] = useState<any[]>([]);
  const [currentAlert, setCurrentAlert] = useState<any>(null);
  const [isAlertCooldown, setIsAlertCooldown] = useState(false);
  const [showEnemyTurnBanner, setShowEnemyTurnBanner] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const seenAlerts = useRef<Set<string>>(new Set());
  const prevHpRef = useRef<Record<string, number>>({});
  const prevEnemyHpRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (match?.alerts && match.alerts.length > 0) {
      const newAlerts = match.alerts.filter((a: any) => !seenAlerts.current.has(a.id));
      if (newAlerts.length > 0) {
        newAlerts.forEach((a: any) => seenAlerts.current.add(a.id));
        setAlertQueue(prev => [...prev, ...newAlerts]);
      }
    }
  }, [match?.alerts]);

  useEffect(() => {
    if (!currentAlert && alertQueue.length > 0 && !isAlertCooldown) {
      const next = alertQueue[0];
      setCurrentAlert(next);
      setAlertQueue(prev => prev.slice(1));
      
      const timer = setTimeout(() => {
        setCurrentAlert(null);
        setIsAlertCooldown(true);
        setTimeout(() => setIsAlertCooldown(false), 200); // Pequeño espacio entre alertas
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentAlert, alertQueue, isAlertCooldown]);

  useEffect(() => {
    if (match?.status === 'waiting') {
      seenAlerts.current.clear();
    }
  }, [match?.status]);

  useEffect(() => {
    if (match?.phase === 'enemy') {
      setShowEnemyTurnBanner(true);
      playSound(SOUNDS.TURN);
      const timer = setTimeout(() => setShowEnemyTurnBanner(false), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowEnemyTurnBanner(false);
    }
  }, [match?.phase]);

  useEffect(() => {
    if (match?.players) {
      const newHits: Record<string, boolean> = {};
      let hasChanges = false;
      match.players.forEach((p: any) => {
        const prevHp = prevHpRef.current[p.uid];
        if (prevHp !== undefined && p.hp < prevHp) {
          newHits[p.uid] = true;
          hasChanges = true;
          playSound(SOUNDS.DAMAGE);
        }
        prevHpRef.current[p.uid] = p.hp;
      });

      if (hasChanges) {
        setHitHeroes(prev => ({ ...prev, ...newHits }));
        setTimeout(() => {
          setHitHeroes(prev => {
            const next = { ...prev };
            Object.keys(newHits).forEach(uid => delete next[uid]);
            return next;
          });
        }, 400);
      }
    }

    if (match?.enemy) {
      const currentEnemyHp = match.enemy.hp;
      if (prevEnemyHpRef.current !== null && currentEnemyHp < prevEnemyHpRef.current) {
        setEnemyHit(true);
        playSound(SOUNDS.DAMAGE);
        setTimeout(() => setEnemyHit(false), 400);
      }
      prevEnemyHpRef.current = currentEnemyHp;
    } else {
      if (prevEnemyHpRef.current !== null) {
        playSound(SOUNDS.DEFEAT);
      }
      prevEnemyHpRef.current = null;
    }
  }, [match?.players, match?.enemy]);

  useEffect(() => {
    if (!matchId) return;
    return onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      setMatch(snap.data());
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      if (error.message.includes("permissions")) {
        setPermissionError(true);
      }
    });
  }, [matchId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [match?.log]);

  if (permissionError) {
    return (
      <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
        <i className="fa-solid fa-shield-halved text-5xl text-red-500 mb-6"></i>
        <h2 className="fantasy-font text-2xl mb-4 uppercase">Error de Permisos</h2>
        <p className="text-slate-500 text-xs mb-8 uppercase tracking-widest leading-relaxed">
          No tienes permisos para acceder a esta partida.<br/>
          Asegúrate de que las reglas de Firestore permitan lectura/escritura en la colección 'matches'.
        </p>
        <button onClick={onLeave} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Volver</button>
      </div>
    );
  }

  if (!match) return null;

  const myP = match.players.find((p: any) => p.uid === match.activeTurnUid);
  const isMyTurn = myP?.ownerUid === user.uid && match.phase === 'players' && (myP?.hp ?? 0) > 0;
  const myReadyToAdvance = match.playersReadyForNext?.includes(user.uid);
  const isHost = match.players.find((p: any) => p.ownerUid === user.uid)?.role === 'host';

  const getEnemyTarget = (currentMatch: any) => {
    const alivePlayers = currentMatch.players.filter((p: any) => p.hp > 0);
    if (alivePlayers.length === 0) return { target: null, reason: null };

    const currentTurnCount = (currentMatch.enemy.turnCount || 0) + 1;
    const damageDealtBy = currentMatch.enemy.damageDealtBy || {};
    const totalDamageDealt = Object.values(damageDealtBy).reduce((acc: number, val: any) => acc + (val || 0), 0);

    // Regla: Ataque sorpresa (Turno 1 y nadie ha hecho daño aún)
    if (currentTurnCount === 1 && totalDamageDealt === 0) {
      return { target: alivePlayers[Math.floor(Math.random() * alivePlayers.length)], reason: 'surprise' };
    }

    // Mecánica "Eslabón Frágil" (1 en 6 de atacar al de menos vida)
    const fragileLinkRoll = Math.floor(Math.random() * 6) + 1;
    if (fragileLinkRoll === 1) {
      const minHp = Math.min(...alivePlayers.map((p: any) => p.hp));
      const candidates = alivePlayers.filter((p: any) => p.hp === minHp);
      return { target: candidates[Math.floor(Math.random() * candidates.length)], reason: 'fragile' };
    }

    // Regla Principal: Más daño causado
    const maxDmg = Math.max(...alivePlayers.map((p: any) => damageDealtBy[p.uid] || 0));
    const damageCandidates = alivePlayers.filter((p: any) => (damageDealtBy[p.uid] || 0) === maxDmg);

    if (damageCandidates.length === 1 && maxDmg > 0) {
      return { target: damageCandidates[0], reason: 'damage' };
    }

    // Empate en daño: Menos vida
    const minHpInDamageTied = Math.min(...damageCandidates.map((p: any) => p.hp));
    const hpCandidates = damageCandidates.filter((p: any) => p.hp === minHpInDamageTied);

    // Si hay empate en vida también, aleatorio entre ellos
    return { target: hpCandidates[Math.floor(Math.random() * hpCandidates.length)], reason: 'tied' };
  };

  const useAbility = async (ability: any, targetUid?: string, entityIdx?: number) => {
    if (!isMyTurn || (myP?.hp ?? 0) <= 0 || myP.pa < ability.cost) return;

    // Si es un ataque a un grupo y no se ha seleccionado un objetivo específico
    if (ability.type === 'Attack' && match.enemy?.isGroup && entityIdx === undefined && ability.id !== 'incinerate') {
      const aliveEntities = match.enemy.entities.filter((e: any) => e.hp > 0);
      if (ability.id === 'multi_shot') {
        if (aliveEntities.length > 1) {
          setTargeting({ ability, isMultiShot: true, shotsLeft: 2 });
          return;
        } else {
          // Solo hay uno vivo, atacar automáticamente al que queda
          const targetIdx = match.enemy.entities.findIndex((e: any) => e.hp > 0);
          entityIdx = targetIdx; 
        }
      } else {
        setTargeting({ ability, isGroupAttack: true });
        return;
      }
    }

    playSound(SOUNDS.ABILITY);
    let updatedPlayers = [...match.players];
    let updatedEnemy = match.enemy ? { ...match.enemy } : null;
    let logMsg = "";

    if (ability.type === 'Attack' && updatedEnemy) {
      setAnimatingHero(myP.uid);
      setTimeout(() => setAnimatingHero(null), 400);

      const { extraPower } = getExtraStats(myP);
      let enemyDef = updatedEnemy.def || 0;
      if (updatedEnemy.isGroup && entityIdx !== undefined) {
        enemyDef = updatedEnemy.entities[entityIdx].def || 0;
      }
      let damage = Math.max(0, (ability.power + extraPower) - enemyDef);
      
      if (updatedEnemy.isGroup && entityIdx !== undefined && ability.id !== 'incinerate' && ability.id !== 'multi_shot') {
        const entity = updatedEnemy.entities[entityIdx];
        entity.hp = Math.max(0, entity.hp - damage);
        updatedEnemy.hp = updatedEnemy.entities.reduce((acc: number, e: any) => acc + e.hp, 0);
        logMsg = `${myP.name} usa ${ability.name} causando ${damage} daño a ${entity.name}.`;
      } else if (ability.id === 'multi_shot') {
        const { extraPower } = getExtraStats(myP);
        const shotPower = 2; // 2 de poder por flecha (total 4)
        
        if (updatedEnemy.isGroup && entityIdx !== undefined) {
          const entity = updatedEnemy.entities[entityIdx];
          const enemyDef = entity.def || 0;
          const damagePerShot = Math.max(0, (shotPower + extraPower) - enemyDef);
          
          const shotsLeft = targeting?.shotsLeft || 2;
          const aliveEntitiesCount = updatedEnemy.entities.filter((e: any) => e.hp > 0).length;

          if (shotsLeft === 2 && aliveEntitiesCount === 1) {
            // Un solo enemigo vivo en el grupo: ataque automático doble
            const totalDmg = damagePerShot * 2;
            entity.hp = Math.max(0, entity.hp - totalDmg);
            updatedEnemy.hp = updatedEnemy.entities.reduce((acc: number, e: any) => acc + e.hp, 0);
            damage = totalDmg;
            logMsg = `${myP.name} usa ${ability.name} contra ${entity.name} causando ${totalDmg} daño (2 flechas).`;
            setTargeting(null);
          } else if (shotsLeft === 2) {
            // Más de un enemigo vivo: primer disparo manual
            entity.hp = Math.max(0, entity.hp - damagePerShot);
            updatedEnemy.hp = updatedEnemy.entities.reduce((acc: number, e: any) => acc + e.hp, 0);
            damage = damagePerShot;
            logMsg = `${myP.name} lanza una flecha a ${entity.name} causando ${damagePerShot} daño.`;
            
            updatedEnemy.damageDealtBy = updatedEnemy.damageDealtBy || {};
            updatedEnemy.damageDealtBy[myP.uid] = (updatedEnemy.damageDealtBy[myP.uid] || 0) + damage;

            const meIdx = updatedPlayers.findIndex(p => p.uid === myP.uid);
            updatedPlayers[meIdx].pa -= ability.cost;
            updatedPlayers[meIdx].cooldowns = updatedPlayers[meIdx].cooldowns || {};
            updatedPlayers[meIdx].cooldowns[ability.id] = ability.cooldown || 0;

            if (updatedEnemy.hp <= 0) {
              setTargeting(null);
            } else {
              setTargeting({ ability, isMultiShot: true, shotsLeft: 1 });
              await safeUpdateDoc(doc(db, 'matches', matchId), { 
                players: updatedPlayers, 
                enemy: updatedEnemy, 
                log: arrayUnion(logMsg) 
              });
              return;
            }
          } else {
            // Segundo disparo manual
            entity.hp = Math.max(0, entity.hp - damagePerShot);
            updatedEnemy.hp = updatedEnemy.entities.reduce((acc: number, e: any) => acc + e.hp, 0);
            damage = damagePerShot;
            logMsg = `${myP.name} lanza la segunda flecha a ${entity.name} causando ${damagePerShot} daño.`;
            setTargeting(null);
          }
        } else if (!updatedEnemy.isGroup) {
          // Enemigo único: ataque automático doble
          const enemyDef = updatedEnemy.def || 0;
          const damagePerShot = Math.max(0, (shotPower + extraPower) - enemyDef);
          const totalDmg = damagePerShot * 2;
          updatedEnemy.hp = Math.max(0, updatedEnemy.hp - totalDmg);
          damage = totalDmg;
          logMsg = `${myP.name} usa ${ability.name} causando ${totalDmg} daño (2 flechas).`;
        }
      } else {
        if (ability.id === 'incinerate') {
          if (updatedEnemy.isGroup) {
            let totalDmg = 0;
            const enemyDefGlobal = updatedEnemy.def || 0;
            updatedEnemy.entities = updatedEnemy.entities.map((e: any) => {
              if (e.hp > 0) {
                const eDef = e.def !== undefined ? e.def : enemyDefGlobal;
                const dmg = Math.max(0, 2 - eDef);
                totalDmg += dmg;
                return { ...e, hp: Math.max(0, e.hp - dmg) };
              }
              return e;
            });
            updatedEnemy.hp = updatedEnemy.entities.reduce((acc: number, e: any) => acc + e.hp, 0);
            damage = totalDmg;
            logMsg = `${myP.name} usa ${ability.name} causando ${totalDmg} de daño total al grupo.`;
          } else {
            const enemyDef = updatedEnemy.def || 0;
            const dmg = Math.max(0, 3 - enemyDef);
            damage = dmg;
            updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
            updatedEnemy.burnTurns = 2;
            logMsg = `${myP.name} usa ${ability.name} causando ${damage} de daño e incendiando al enemigo.`;
          }
        } else {
          logMsg = `${myP.name} usa ${ability.name} causando ${damage} daño.`;
          updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
        }
      }

      updatedEnemy.damageDealtBy = updatedEnemy.damageDealtBy || {};
      updatedEnemy.damageDealtBy[myP.uid] = (updatedEnemy.damageDealtBy[myP.uid] || 0) + damage;
    } else if (ability.type === 'Support' && (targetUid || ability.id === 'distraction_shot')) {
      const targetIdx = targetUid ? updatedPlayers.findIndex(p => p.uid === targetUid) : -1;
      
      if (ability.id === 'magic_shield' && targetIdx !== -1) {
        updatedPlayers[targetIdx].shield = (updatedPlayers[targetIdx].shield || 0) + 2;
        logMsg = `${myP.name} otorga un Escudo Mágico a ${updatedPlayers[targetIdx].name}.`;
      } else if (ability.id === 'intervene' && targetIdx !== -1) {
        updatedPlayers[targetIdx].intervenedBy = myP.uid;
        logMsg = `${myP.name} se prepara para intervenir por ${updatedPlayers[targetIdx].name}.`;
      } else if (ability.id === 'distraction_shot') {
        const roll = Math.floor(Math.random() * 20) + 1;
        if (roll >= 6) {
          if (updatedEnemy) updatedEnemy.distracted = true;
          logMsg = `${myP.name} usa Disparo de Distracción con éxito (Dado: ${roll}). El enemigo está distraído.`;
        } else {
          logMsg = `${myP.name} falla el Disparo de Distracción (Dado: ${roll}).`;
        }
      }
    }

    const meIdx = updatedPlayers.findIndex(p => p.uid === myP.uid);
    // No restar PA si es el segundo disparo del Cazador (ya se restó en el primero)
    if (!(ability.id === 'multi_shot' && targeting?.shotsLeft === 1)) {
      updatedPlayers[meIdx].pa -= ability.cost;
      updatedPlayers[meIdx].cooldowns = updatedPlayers[meIdx].cooldowns || {};
      updatedPlayers[meIdx].cooldowns[ability.id] = ability.cooldown || 0;

      // Tracking Individual Mission: save_pa
      if (updatedPlayers[meIdx].individualMission?.type === 'save_pa' && updatedPlayers[meIdx].individualMission.status === 'active') {
        updatedPlayers[meIdx].individualMission.progress += ability.cost;
        if (updatedPlayers[meIdx].individualMission.progress > updatedPlayers[meIdx].individualMission.target) {
          updatedPlayers[meIdx].individualMission.status = 'failed';
        }
      }
    }

    const updates: any = { players: updatedPlayers, log: arrayUnion(logMsg) };
    
    if (updatedEnemy) {
      updates.enemy = updatedEnemy;
      if (updatedEnemy.hp === 0) {
        playSound(SOUNDS.DEFEAT);
        updates.enemy = null;
        const defeatMsg = `¡${updatedEnemy.name} derrotado!`;
        updates.log = arrayUnion(defeatMsg);
        
        // Tracking Individual Mission: last_hit
        if (updatedPlayers[meIdx].individualMission?.type === 'last_hit' && updatedPlayers[meIdx].individualMission.status === 'active') {
          updatedPlayers[meIdx].individualMission.progress += 1;
          if (updatedPlayers[meIdx].individualMission.progress >= updatedPlayers[meIdx].individualMission.target) {
            updatedPlayers[meIdx].individualMission.status = 'completed';
          }
        }

        if (match.mission && match.mission.type === 'kill' && !match.mission.completed) {
          const newProgress = match.mission.progress + 1;
          const isCompleted = newProgress >= match.mission.target;
          updates.mission = { 
            ...match.mission, 
            progress: newProgress,
            completed: isCompleted
          };
          if (isCompleted) {
            const reward = getRewardItem();
            updates.sharedInventory = arrayUnion(reward);
            updates.log = arrayUnion(`¡MISIÓN COMPLETADA: ${match.mission.name}! Recompensa: ${reward.name}.`);
          }
        }
      }
    }

    await updateDoc(doc(db, 'matches', matchId), updates);
    setTargeting(null);
  };

  const executeEnemyTurn = async (currentMatch: any) => {
    if (!isHost || !currentMatch.enemy) return;
    
    const currentTurnCount = (currentMatch.enemy.turnCount || 0) + 1;
    let logMsg = "";
    let finalPlayers;
    let turnAlerts: any[] = [];
    let enemyHp = currentMatch.enemy.hp || 0;
    let burnTurns = currentMatch.enemy.burnTurns || 0;
    let updatedEntities = currentMatch.enemy.isGroup ? [...currentMatch.enemy.entities] : null;

    // Habilidad especial: Fragmento de T'zel (Daño en área cada 5 turnos)
    if (currentMatch.enemy.name === "Fragmento de T'zel" && currentTurnCount % 5 === 0) {
      finalPlayers = currentMatch.players.map((p: any) => {
        const dmg = 10;
        const newHp = Math.max(0, p.hp - dmg);
        
        let updatedMission = p.individualMission ? { ...p.individualMission } : null;
        if (updatedMission?.type === 'protect' && updatedMission.status === 'active') {
          const otherPlayersDamage = currentMatch.players.reduce((acc: number, otherP: any) => {
             if (otherP.uid !== p.uid) return acc + dmg;
             return acc;
          }, 0);
          updatedMission.progress += otherPlayersDamage;
          if (updatedMission.progress >= updatedMission.target) {
            updatedMission.status = 'failed';
          }
        }

        return {
          ...p,
          hp: newHp,
          pa: Math.min(p.maxPa || 6, p.pa + 2),
          shield: 0, intervenedBy: null,
          individualMission: updatedMission
        };
      });
      logMsg = `¡EL FRAGMENTO DE T'ZEL ESTALLA! 10 de daño directo a todo el grupo.`;
    } else if (currentMatch.enemy.distracted) {
      // Disparo de Distracción del Cazador
      logMsg += `${currentMatch.enemy.name} intenta atacar pero falla por la distracción.`;
      finalPlayers = currentMatch.players.map((p: any) => ({
        ...p,
        pa: Math.min(p.maxPa || 6, p.pa + 2),
        shield: p.shield || 0,
        intervenedBy: null
      }));
      currentMatch.enemy.distracted = false;
    } else {
      // Daño por quemadura
      let burnDmg = 0;
      
      if (burnTurns > 0) {
        burnDmg = 1;
        if (updatedEntities) {
          const firstAlive = updatedEntities.find((e: any) => e.hp > 0);
          if (firstAlive) {
            firstAlive.hp = Math.max(0, firstAlive.hp - 1);
            enemyHp = updatedEntities.reduce((acc: number, e: any) => acc + e.hp, 0);
          }
        } else {
          enemyHp = Math.max(0, enemyHp - 1);
        }
        burnTurns -= 1;
        logMsg += `(Quemadura: -1 HP) `;
      }

      const { target: targetP, reason } = getEnemyTarget(currentMatch);
      if (reason === 'fragile') turnAlerts.push({ text: "¡ESLABÓN FRÁGIL!", type: "fragile", id: `fragile-${Date.now()}-${Math.random()}` });

      let actualTarget = targetP;
      if (targetP?.intervenedBy) {
        actualTarget = currentMatch.players.find((p: any) => p.uid === targetP.intervenedBy) || targetP;
        logMsg += `¡Intervención! `;
      }

      const aliveEntities = currentMatch.enemy.isGroup ? currentMatch.enemy.entities.filter((e: any) => e.hp > 0) : [];
      let enemyBaseDmg = 0;
      if (currentMatch.enemy.isGroup) {
        if (currentMatch.enemy.damagePerEntity) {
          enemyBaseDmg = aliveEntities.length * currentMatch.enemy.damagePerEntity;
        } else {
          enemyBaseDmg = aliveEntities.reduce((acc: number, e: any) => acc + (e.damage || 0), 0);
        }
      } else {
        enemyBaseDmg = currentMatch.enemy.damage;
      }

      const isDirectHit = Math.random() < 0.05;
      let enemyDmg = 0;
      let targetShield = actualTarget?.shield || 0;

      if (isDirectHit && enemyBaseDmg > 0) {
        enemyDmg = enemyBaseDmg;
        playSound(SOUNDS.DAMAGE);
        logMsg += `¡GOLPE DIRECTO! `;
        turnAlerts.push({ text: "¡GOLPE DIRECTO!", type: "direct", id: `direct-${Date.now()}-${Math.random()}` });
      } else {
        const { extraDef } = getExtraStats(actualTarget);
        const baseDef = CLASSES[actualTarget.classType]?.def || 0;
        enemyDmg = enemyBaseDmg > 0 ? Math.max(1, enemyBaseDmg - (baseDef + extraDef)) : 0;
        
        // Aplicar Escudo
        if (targetShield > 0) {
          const absorbed = Math.min(enemyDmg, targetShield);
          enemyDmg -= absorbed;
          targetShield -= absorbed;
          logMsg += `(Escudo absorbe ${absorbed}) `;
        }
      }

      finalPlayers = currentMatch.players.map((p: any) => {
        let newHp = p.hp;
        let newShield = p.shield || 0;
        if (p.uid === actualTarget?.uid) {
          newHp = Math.max(0, p.hp - enemyDmg);
          newShield = targetShield;
        }

        let updatedMission = p.individualMission ? { ...p.individualMission } : null;
        if (updatedMission?.type === 'protect' && updatedMission.status === 'active') {
          // Check damage to OTHER players
          const otherPlayersDamage = currentMatch.players.reduce((acc: number, otherP: any) => {
             if (otherP.uid !== p.uid && otherP.uid === actualTarget?.uid) {
               return acc + enemyDmg;
             }
             return acc;
          }, 0);
          
          updatedMission.progress += otherPlayersDamage;
          if (updatedMission.progress >= updatedMission.target) {
            updatedMission.status = 'failed';
          }
        }

        return {
          ...p,
          hp: newHp,
          shield: newShield,
          pa: Math.min(p.maxPa || 6, p.pa + 2),
          intervenedBy: null,
          individualMission: updatedMission
        };
      });
      
      if (currentMatch.enemy.isGroup) {
        if (currentMatch.enemy.name === "N'hamat") {
          logMsg += `N'hamat y sus súbditos atacan a ${actualTarget?.name} causando ${enemyDmg} daño total.`;
        } else {
          const entityNames = aliveEntities.map((e: any) => e.name).join(", ");
          logMsg += `Los ${aliveEntities.length} goblins (${entityNames}) atacan a ${actualTarget?.name} causando ${enemyDmg} daño total.`;
        }
      } else {
        logMsg += enemyDmg > 0 
          ? `${currentMatch.enemy.name} ataca a ${actualTarget?.name} causando ${enemyDmg} daño.` 
          : `${currentMatch.enemy.name} vibra con una energía oscura... (${currentTurnCount}/5)`;
      }
      
      if (enemyDmg > 0) {
        playSound(SOUNDS.DAMAGE);
        if (currentMatch.enemy.name === "N'hamat") {
          const successfulAttacks = (currentMatch.enemy.successfulAttacks || 0) + 1;
          currentMatch.enemy.successfulAttacks = successfulAttacks;
          if (successfulAttacks % 3 === 0) {
            const minionId = `minion-${Date.now()}`;
            const newMinion = { id: minionId, name: "Súbdito de N'hamat", hp: 10, maxHp: 10, damage: 3, def: 0 };
            updatedEntities.push(newMinion);
            enemyHp += 10;
            logMsg += ` ¡N'hamat invoca un Súbdito!`;
            turnAlerts.push({ text: "¡INVOCACIÓN!", type: "summon", id: `summon-${Date.now()}` });
          }
        }
      }
    }

    // Update enemy state for the next turn
    currentMatch.enemy.hp = enemyHp;
    currentMatch.enemy.burnTurns = burnTurns;

    const enemyUpdates: any = {
      players: finalPlayers,
      phase: 'players',
      activeTurnUid: currentMatch.turnOrder.find((uid: string) => {
        const p = finalPlayers.find((pl: any) => pl.uid === uid);
        return p && p.hp > 0;
      }) || currentMatch.turnOrder[0],
      log: arrayUnion(logMsg),
      "enemy.turnCount": currentTurnCount,
      "enemy.damageDealtBy": {},
      "enemy.burnTurns": burnTurns,
      "enemy.hp": enemyHp,
      "enemy.successfulAttacks": currentMatch.enemy.successfulAttacks || 0,
      "enemy.distracted": false
    };

    if (updatedEntities) {
      enemyUpdates["enemy.entities"] = updatedEntities;
    }

    if (turnAlerts.length > 0) {
      enemyUpdates.alerts = arrayUnion(...turnAlerts);
    }

    if (enemyHp <= 0) {
      playSound(SOUNDS.DEFEAT);
      const defeatMsg = `¡${currentMatch.enemy.name} sucumbe a sus heridas!`;
      enemyUpdates.enemy = null;
      enemyUpdates.log = arrayUnion(defeatMsg);
    }

    await safeUpdateDoc(doc(db, 'matches', matchId), enemyUpdates);
  };

  const endTurn = async () => {
    playSound(SOUNDS.TURN);
    const currentIndex = match.turnOrder.indexOf(match.activeTurnUid);
    let nextIndex = currentIndex + 1;
    let nextUid = null;
    
    // Buscar el siguiente jugador vivo en esta ronda
    while (nextIndex < match.turnOrder.length) {
      const candidateUid = match.turnOrder[nextIndex];
      const candidateP = match.players.find((p: any) => p.uid === candidateUid);
      if (candidateP && candidateP.hp > 0) {
        nextUid = candidateUid;
        break;
      }
      nextIndex++;
    }

    const updates: any = {};
    
    if (nextUid) {
      // Hay un siguiente jugador vivo en esta ronda
      const updatedPlayers = match.players.map((p: any) => {
        if (p.uid === nextUid) {
          const newCooldowns = { ...(p.cooldowns || {}) };
          Object.keys(newCooldowns).forEach(k => {
            if (newCooldowns[k] > 0) newCooldowns[k] -= 1;
          });
          return { ...p, cooldowns: newCooldowns };
        }
        return p;
      });
      updates.activeTurnUid = nextUid;
      updates.players = updatedPlayers;
    } else {
      // No hay más jugadores vivos esta ronda, pasar al enemigo
      updates.phase = 'enemy';
      
      // Encontrar el primer jugador vivo para la SIGUIENTE ronda (para reducir sus CDs)
      const firstAliveUid = match.turnOrder.find((uid: string) => {
        const p = match.players.find((pl: any) => pl.uid === uid);
        return p && p.hp > 0;
      });

      const updatedPlayers = match.players.map((p: any) => {
        if (p.uid === firstAliveUid) {
          const newCooldowns = { ...(p.cooldowns || {}) };
          Object.keys(newCooldowns).forEach(k => {
            if (newCooldowns[k] > 0) newCooldowns[k] -= 1;
          });
          return { ...p, cooldowns: newCooldowns };
        }
        return p;
      });
      updates.players = updatedPlayers;

      if (isHost && match.enemy) {
        // Pasamos el estado actualizado de los jugadores para que el turno enemigo use los CDs corregidos
        setTimeout(() => executeEnemyTurn({ ...match, players: updatedPlayers }), 1000);
      }
    }
    await updateDoc(doc(db, 'matches', matchId), updates);
  };

  const toggleReadyToAdvance = async () => {
    const newList = myReadyToAdvance 
      ? match.playersReadyForNext.filter((id: string) => id !== user.uid)
      : [...(match.playersReadyForNext || []), user.uid];
    
    await safeUpdateDoc(doc(db, 'matches', matchId), { playersReadyForNext: newList });

    const uniqueOwners = new Set(match.players.map((p: any) => p.ownerUid)).size;
    if (newList.length === uniqueOwners && isHost && !match.enemy && !match.currentCard && match.deckRemaining > 0) {
      const isLastCard = match.deckRemaining === 1;
      const roll = isLastCard ? 0 : Math.random();
      const initialDeckSize = DIFFICULTY_CONFIG[match.difficulty];
      const updates: any = { 
        playersReadyForNext: [], 
        deckRemaining: increment(-1) 
      };

      // Check Individual Mission Deadline
      const currentCardIndex = initialDeckSize - match.deckRemaining + 1;
      if (currentCardIndex === 5) {
        updates.players = match.players.map((p: any) => {
          if (p.individualMission && p.individualMission.status === 'active') {
            let success = false;
            if (p.individualMission.type === 'last_hit') success = p.individualMission.progress >= 4;
            if (p.individualMission.type === 'protect') success = p.individualMission.progress < 15;
            if (p.individualMission.type === 'save_pa') success = p.individualMission.progress <= 20;

            const status = success ? 'completed' : 'failed';
            const logMsg = success 
              ? `¡${p.name} completó su misión individual! Recompensa aplicada.` 
              : `¡${p.name} falló su misión individual! Penalización aplicada.`;
            
            updates.log = updates.log || [];
            updates.log.push(logMsg);

            // Apply Rewards/Penalties
            let extraAtk = p.extraAtk || 0;
            let hp = p.hp;
            let maxHp = p.maxHp || CLASSES[p.classType].hp;
            let maxPa = p.maxPa || 6;

            if (p.individualMission.type === 'last_hit') {
              extraAtk += success ? 1 : -1;
            } else if (p.individualMission.type === 'protect') {
              if (success) {
                hp += 5;
                maxHp += 5;
              } else {
                maxHp -= 5;
                hp = Math.min(hp, maxHp);
              }
            } else if (p.individualMission.type === 'save_pa') {
              maxPa = success ? 7 : 5;
            }

            return { 
              ...p, 
              individualMission: { ...p.individualMission, status },
              extraAtk, hp, maxHp, maxPa
            };
          }
          return p;
        });
      }

      if (roll < 0.6) { // 60% Enemigo (o 100% si es la última carta)
        let nextEnemy;
        if (isLastCard) {
          nextEnemy = ENEMIES.find(e => e.name === "N'hamat") || ENEMIES[ENEMIES.length - 1];
        } else {
          const nonBossEnemies = ENEMIES.filter(e => !e.isBoss);
          nextEnemy = nonBossEnemies[Math.floor(Math.random() * nonBossEnemies.length)];
        }
        const startRoll = Math.random();
        let logEntry = `Aparece ${nextEnemy.name}.`;
        let finalPhase = 'players';
        let finalActiveUid = match.turnOrder[0];

        const enemyData = { 
          ...nextEnemy, 
          hp: nextEnemy.hp, 
          maxHp: nextEnemy.maxHp, 
          entities: nextEnemy.entities ? nextEnemy.entities.map((e: any) => ({ ...e })) : null,
          damageDealtBy: {}, 
          turnCount: 0, 
          burnTurns: 0, 
          successfulAttacks: 0 
        };
        let alerts: any[] = [];

        if (startRoll < 1/6) {
          finalPhase = 'enemy';
          logEntry = `¡EL ENEMIGO TOMA LA INICIATIVA! ${nextEnemy.name} ataca primero.`;
          alerts.push({ text: "¡ATAQUE SORPRESA!", type: "surprise", id: `surprise-${Date.now()}-${Math.random()}` });
          setTimeout(() => executeEnemyTurn({ ...match, enemy: enemyData, phase: 'enemy' }), 1000);
        }

        updates.enemy = enemyData;
        updates.log = arrayUnion(logEntry);
        updates.phase = finalPhase;
        updates.activeTurnUid = finalActiveUid;
        if (alerts.length > 0) updates.alerts = arrayUnion(...alerts);
      } else if (roll < 0.8) { // 20% Evento
        updates.currentCard = { 
          type: 'event', 
          name: 'Evento: Calma Chicha', 
          description: 'El viento sopla suavemente entre las ruinas. No sucede nada relevante en este momento...',
          icon: 'fa-wind'
        };
        updates.log = arrayUnion("Evento: Nada sucede.");
      } else { // 20% Cofre
        const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        updates.currentCard = { 
          type: 'chest', 
          name: 'Cofre del Tesoro', 
          description: `¡Has encontrado un objeto valioso!`,
          icon: 'fa-box-open',
          reward: randomItem
        };
        updates.sharedInventory = arrayUnion(randomItem);
        updates.log = arrayUnion(`¡Cofre encontrado! Obtenido: ${randomItem.name}.`);
        
        if (randomItem.type !== 'Usable' && match.mission?.type === 'item' && !match.mission.completed) {
          const newProgress = match.mission.progress + 1;
          const isCompleted = newProgress >= match.mission.target;
          updates.mission = { 
            ...match.mission, 
            progress: newProgress,
            completed: isCompleted
          };
          if (isCompleted) {
            const reward = getRewardItem();
            updates.sharedInventory = arrayUnion(reward);
            updates.log = arrayUnion(`¡MISIÓN COMPLETADA: ${match.mission.name}! Recompensa: ${reward.name}.`);
          }
        }
      }

      await updateDoc(doc(db, 'matches', matchId), updates);
    }
  };

  const clearCard = async () => {
    const updates: any = { currentCard: null, playersReadyForNext: [] };
    if (match.currentCard?.type === 'event' && match.mission?.type === 'event' && !match.mission.completed) {
      const newProgress = match.mission.progress + 1;
      const isCompleted = newProgress >= match.mission.target;
      updates.mission = { 
        ...match.mission, 
        progress: newProgress,
        completed: isCompleted
      };
      if (isCompleted) {
        const reward = getRewardItem();
        updates.sharedInventory = arrayUnion(reward);
        updates.log = arrayUnion(`¡MISIÓN COMPLETADA: ${match.mission.name}! Recompensa: ${reward.name}.`);
      }
    }
    await safeUpdateDoc(doc(db, 'matches', matchId), updates);
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    playSound(SOUNDS.CLICK);
    await safeUpdateDoc(doc(db, 'matches', matchId), {
      chat: arrayUnion({ user: user.email?.split('@')[0], text: msg, time: Date.now() })
    });
    setMsg('');
  };

  const resetMatch = async () => {
    await safeUpdateDoc(doc(db, 'matches', matchId), {
      status: 'waiting',
      enemy: null,
      sharedInventory: [ITEMS[3], ITEMS[3], ITEMS[3]],
      players: match.players.map((p: any) => ({ 
        ...p, 
        isReady: false, 
        hp: CLASSES[p.classType].hp, 
        maxHp: CLASSES[p.classType].hp,
        pa: 6, 
        maxPa: 6,
        extraAtk: 0,
        cooldowns: {}, 
        equipment: [null, null, null], 
        bottomInventory: [],
        individualMission: null
      })),
      log: ["Regresando a la base..."],
      playersReadyForNext: [],
      alerts: []
    });
  };

  const executeEquip = async (playerUid: string, item: any, slotIdx: number) => {
    const newSharedInv = [...(match.sharedInventory || [])];
    const updatedPlayers = match.players.map((p: any) => {
      if (p.uid === playerUid) {
        const newEquip = [...(p.equipment || [null, null, null])];
        if (newEquip[slotIdx]) newSharedInv.push(newEquip[slotIdx]);
        newEquip[slotIdx] = item;
        const itemIdx = newSharedInv.findIndex(i => i.id === item.id);
        if (itemIdx > -1) newSharedInv.splice(itemIdx, 1);
        return { ...p, equipment: newEquip };
      }
      return p;
    });
    const pName = match.players.find((p: any) => p.uid === playerUid)?.name || "Héroe";
    await updateDoc(doc(db, 'matches', matchId), { 
      players: updatedPlayers, 
      sharedInventory: newSharedInv,
      log: arrayUnion(`${pName} se equipa ${item.name}.`)
    });
  };

  const equipItem = async (playerUid: string, item: any, slotIdx: number) => {
    if (match.enemy || match.pendingAction) return;
    
    if (match.mode !== 'multi') {
      await executeEquip(playerUid, item, slotIdx);
    } else {
      await updateDoc(doc(db, 'matches', matchId), {
        pendingAction: {
          type: 'equip',
          item,
          playerUid,
          slotIdx,
          requesterName: match.players.find((p: any) => p.uid === playerUid)?.name || "Héroe"
        },
        votes: {}
      });
    }
  };

  const unequipItem = async (playerUid: string, slotIdx: number) => {
    if (match.enemy) return;
    const newSharedInv = [...(match.sharedInventory || [])];
    const updatedPlayers = match.players.map((p: any) => {
      if (p.uid === playerUid) {
        const newEquip = [...(p.equipment || [null, null, null])];
        if (newEquip[slotIdx]) {
          newSharedInv.push(newEquip[slotIdx]);
          newEquip[slotIdx] = null;
        }
        return { ...p, equipment: newEquip };
      }
      return p;
    });
    await safeUpdateDoc(doc(db, 'matches', matchId), { players: updatedPlayers, sharedInventory: newSharedInv });
  };

  const executeUse = async (playerUid: string, item: any) => {
    const newSharedInv = [...(match.sharedInventory || [])];
    const updatedPlayers = match.players.map((p: any) => {
      if (p.uid === playerUid) {
        const { extraHp } = getExtraStats(p);
        const maxHp = CLASSES[p.classType].hp + extraHp;
        const newHp = Math.min(maxHp, p.hp + item.heal);
        const idx = newSharedInv.findIndex(i => i.id === item.id);
        if (idx > -1) newSharedInv.splice(idx, 1);
        return { ...p, hp: newHp };
      }
      return p;
    });
    const pName = match.players.find((p: any) => p.uid === playerUid)?.name || "Héroe";
    await updateDoc(doc(db, 'matches', matchId), { 
      players: updatedPlayers, 
      sharedInventory: newSharedInv,
      log: arrayUnion(`${pName} usa ${item.name} y recupera ${item.heal} HP.`)
    });
  };

  const useItem = async (playerUid: string, item: any) => {
    if (item.type !== 'Usable' || !item.heal || match.pendingAction) return;
    
    if (match.mode !== 'multi') {
      await executeUse(playerUid, item);
    } else {
      await updateDoc(doc(db, 'matches', matchId), {
        pendingAction: {
          type: 'use',
          item,
          playerUid,
          requesterName: match.players.find((p: any) => p.uid === playerUid)?.name || "Héroe"
        },
        votes: {}
      });
    }
  };

  const handleVote = async (approved: boolean) => {
    if (!match.pendingAction) return;
    playSound(SOUNDS.CLICK);
    
    const newVotes = { ...(match.votes || {}), [user.uid]: approved };
    const otherPlayers = match.players.filter((p: any) => p.uid !== match.pendingAction.playerUid);
    const allVoted = otherPlayers.every((p: any) => newVotes[p.uid] !== undefined);
    
    if (allVoted) {
      const allApproved = otherPlayers.every((p: any) => newVotes[p.uid] === true);
      if (allApproved) {
        if (match.pendingAction.type === 'equip') {
          await executeEquip(match.pendingAction.playerUid, match.pendingAction.item, match.pendingAction.slotIdx!);
        } else {
          await executeUse(match.pendingAction.playerUid, match.pendingAction.item);
        }
      } else {
        await updateDoc(doc(db, 'matches', matchId), { 
          log: arrayUnion(`Acción de ${match.pendingAction.requesterName} rechazada por el grupo.`)
        });
      }
      await safeUpdateDoc(doc(db, 'matches', matchId), { pendingAction: null, votes: {} });
    } else {
      await safeUpdateDoc(doc(db, 'matches', matchId), { votes: newVotes });
    }
  };

  const allDead = match.players.every((p: any) => p.hp <= 0);
  const victory = match.deckRemaining <= 0 && !match.enemy && !match.currentCard;

  if (allDead || victory) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <i className={`fa-solid ${victory ? 'fa-crown text-amber-400' : 'fa-skull text-red-500'} text-7xl mb-6 shadow-2xl`}></i>
        <h1 className="fantasy-font text-5xl text-white mb-2 uppercase tracking-tighter">{victory ? 'VICTORIA' : 'DERROTA'}</h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-16">{victory ? 'Habéis limpiado la mazmorra' : 'Vuestras almas vagan por el abismo'}</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button onClick={resetMatch} className="w-full bg-white text-slate-900 py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Volver a Sala</button>
          <button onClick={onLeave} className="w-full bg-slate-800 text-slate-400 py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Abandonar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white overflow-hidden text-slate-900">
      {/* Alertas de Combate */}
      {currentAlert && (
        <div className="fixed top-1/2 left-1/2 z-[100] pointer-events-none animate-pop-in">
          <div className={`px-6 py-3 rounded-2xl border-2 shadow-2xl flex items-center gap-3 backdrop-blur-md ${
            currentAlert.type === 'surprise' ? 'bg-amber-500/90 border-amber-300 text-white' :
            currentAlert.type === 'direct' ? 'bg-red-600/90 border-red-400 text-white' :
            'bg-indigo-600/90 border-indigo-400 text-white'
          }`}>
            <i className={`fa-solid ${
              currentAlert.type === 'surprise' ? 'fa-bolt-lightning' :
              currentAlert.type === 'direct' ? 'fa-skull-crossbones' :
              'fa-link-slash'
            } text-xl`}></i>
            <span className="fantasy-font font-black text-lg tracking-widest drop-shadow-md">{currentAlert.text}</span>
          </div>
        </div>
      )}

      {/* Alerta de Turno del Enemigo */}
      {showEnemyTurnBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="absolute inset-0 bg-red-900/40 backdrop-blur-[2px]"></div>
          <div className="relative bg-slate-900 border-y-4 border-red-500 w-full py-8 flex flex-col items-center shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-slide-up">
            <div className="flex items-center gap-4 mb-2">
              <i className="fa-solid fa-skull-crossbones text-red-500 text-4xl animate-pulse"></i>
              <h2 className="fantasy-font text-4xl text-white uppercase tracking-[0.2em] drop-shadow-lg">Turno del Enemigo</h2>
              <i className="fa-solid fa-skull-crossbones text-red-500 text-4xl animate-pulse"></i>
            </div>
            <p className="text-red-400 font-black uppercase tracking-[0.4em] text-xs animate-bounce">¡Prepárate para el impacto!</p>
          </div>
        </div>
      )}

      {/* Header: Misión y Progreso */}
      <div className="bg-slate-950 text-white p-2 flex justify-between items-center border-b border-white/10 z-20">
        <div className="flex flex-col">
          <span className="fantasy-font uppercase tracking-[0.1em] text-[8px] text-slate-400">
            MISIÓN GRUPAL: {match.mission?.name || 'SIN MISIÓN'}
          </span>
          {match.mission && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-500 ${match.mission.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  style={{ width: `${Math.min(100, (match.mission.progress / match.mission.target) * 100)}%` }}
                ></div>
              </div>
              <span className={`text-[8px] font-black uppercase ${match.mission.completed ? 'text-emerald-400' : 'text-slate-300'}`}>
                {match.mission.progress}/{match.mission.target} {match.mission.completed && '✓'}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="fantasy-font text-base tracking-tighter text-white">
            {DIFFICULTY_CONFIG[match.difficulty] - match.deckRemaining}/{DIFFICULTY_CONFIG[match.difficulty]}
          </span>
        </div>
      </div>

      {/* Área Principal: Mazo de Incursión y Notación */}
      <div className="flex-grow flex p-2 gap-2 overflow-hidden">
        {/* Izquierda: Mazo de Incursión */}
        <div className="flex-[1.8] bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-4 relative shadow-2xl">
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2">
              <i className="fa-solid fa-layer-group text-5xl text-amber-500/5"></i>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-dice-d20 text-3xl text-amber-500 animate-spin-slow drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"></i>
              </div>
            </div>
            <p className="fantasy-font text-base uppercase tracking-[0.1em] text-amber-600 mb-4 drop-shadow-md">Mazo de Incursión</p>
          </div>

          {!match.enemy && !match.currentCard ? (
            <div className="flex flex-col items-center">
              <button 
                onClick={toggleReadyToAdvance}
                className="bg-amber-600 text-white fantasy-font text-base px-8 py-3 rounded-xl shadow-[0_6px_20px_rgba(217,119,6,0.4)] hover:bg-amber-500 active:scale-95 transition-all border-b-4 border-amber-800 font-bold uppercase tracking-widest"
              >
                {match.deckRemaining === DIFFICULTY_CONFIG[match.difficulty] ? 'INICIAR' : 'AVANZAR'}
              </button>
              <div className="mt-6 flex items-center gap-2 text-white">
                <span className="fantasy-font text-2xl tracking-tighter">{DIFFICULTY_CONFIG[match.difficulty] - match.deckRemaining}/{DIFFICULTY_CONFIG[match.difficulty]}</span>
                <i className="fa-solid fa-layer-group text-lg opacity-50"></i>
              </div>
            </div>
          ) : match.currentCard ? (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="relative mb-4">
                <i className={`fa-solid ${match.currentCard.icon} text-[5rem] text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]`}></i>
                {match.currentCard.type === 'chest' && <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce">¡NUEVO OBJETO!</div>}
              </div>
              <h3 className="fantasy-font text-xl text-white uppercase mb-1">{match.currentCard.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold mb-6 max-w-[200px] leading-tight">{match.currentCard.description}</p>
              
              {match.currentCard.reward && (
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-amber-500">
                    <i className={`fa-solid ${match.currentCard.reward.icon} text-xl`}></i>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-white uppercase">{match.currentCard.reward.name}</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">{match.currentCard.reward.type}</p>
                  </div>
                </div>
              )}

              <button 
                onClick={clearCard}
                className="bg-slate-800 text-white fantasy-font text-sm px-6 py-2 rounded-lg hover:bg-slate-700 transition-all border-b-2 border-slate-950"
              >
                CONTINUAR
              </button>
            </div>
          ) : (
            <div className={`flex flex-col items-center mt-4 w-full ${enemyHit ? 'animate-shake' : ''}`}>
              <div className="relative group mb-2">
                <i className={`fa-solid ${match.enemy.icon} text-[6rem] text-white/90 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-105`}></i>
                {match.phase === 'enemy' && <div className="absolute inset-0 bg-red-500/20 animate-ping rounded-full scale-125 -z-10"></div>}
              </div>
              
              <div className="w-full max-w-[180px]">
                <div className="bg-white/10 border border-white/20 py-1 px-3 rounded-full text-center shadow-sm mb-2">
                  <h2 className="fantasy-font text-[11px] uppercase text-white tracking-tighter truncate">{match.enemy.name}</h2>
                </div>

                {match.enemy.isGroup && (
                  <div className="space-y-1.5 mt-2">
                    {match.enemy.entities.map((entity: any, idx: number) => (
                      <div 
                        key={entity.id} 
                        onClick={() => (targeting?.isGroupAttack || targeting?.isMultiShot) && entity.hp > 0 && useAbility(targeting.ability, undefined, idx)}
                        className={`p-1.5 rounded-lg border transition-all ${entity.hp > 0 ? ((targeting?.isGroupAttack || targeting?.isMultiShot) ? 'bg-red-900/40 border-red-500 cursor-pointer hover:scale-105 ring-2 ring-red-500/30' : 'bg-white/5 border-white/10') : 'bg-slate-900/50 border-slate-800 grayscale opacity-50'}`}
                      >
                        <div className="flex justify-between text-[7px] font-black text-white/70 uppercase mb-1">
                          <span>{entity.name}</span>
                          <span>{entity.hp}/{entity.maxHp}</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(entity.hp / entity.maxHp) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!match.enemy.isGroup && (
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10 shadow-inner mt-2">
                    <div className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-1000" style={{ width: `${(match.enemy.hp / match.enemy.maxHp) * 100}%` }}></div>
                  </div>
                )}

                <div className="flex justify-between mt-1 px-1">
                  <span className="text-[8px] font-black uppercase text-white/60">
                    {match.enemy.hp}/{match.enemy.maxHp}
                  </span>
                  <div className="flex gap-1.5">
                    {match.enemy.distracted && <span className="text-[8px] font-black uppercase text-emerald-400 animate-pulse"><i className="fa-solid fa-eye-slash mr-0.5"></i>DISTRAÍDO</span>}
                    {match.enemy.burnTurns > 0 && <span className="text-[8px] font-black uppercase text-orange-500 animate-pulse"><i className="fa-solid fa-fire mr-0.5"></i>({match.enemy.burnTurns})</span>}
                    <span className="text-[8px] font-black uppercase text-red-500">
                      A:{match.enemy.isGroup 
                        ? match.enemy.entities.reduce((acc: number, e: any) => acc + (e.damage || 0), 0) 
                        : match.enemy.damage}
                    </span>
                    <span className="text-[8px] font-black uppercase text-blue-400">D:{match.enemy.def}</span>
                  </div>
                </div>

                {match.enemy.skillDesc && (
                  <div className="mt-3 bg-black/40 p-2 rounded-xl border border-white/5">
                    <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                      <i className="fa-solid fa-circle-info mr-1 text-amber-500/50"></i>
                      {match.enemy.skillDesc}
                    </p>
                    {match.enemy.name === "N'hamat" && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 transition-all duration-500" 
                            style={{ width: `${((match.enemy.successfulAttacks || 0) % 3) / 3 * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-[6px] font-black text-amber-500 uppercase">Invocación: {(match.enemy.successfulAttacks || 0) % 3}/3</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Derecha: Notación y Chat */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="bg-slate-50 rounded-xl p-3 flex-grow border border-slate-200 shadow-inner flex flex-col overflow-hidden">
            <h3 className="fantasy-font text-[9px] mb-2 border-b border-slate-200 pb-1 text-slate-400 uppercase tracking-widest">NOTACIÓN</h3>
            <div className="flex-grow overflow-y-auto no-scrollbar space-y-2">
              {match.log?.slice(-4).map((l: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[9px] font-bold text-slate-600 animate-fade-in">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${l.includes('daño') ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                  <span className="leading-tight">{l}</span>
                </div>
              ))}
              <div ref={logEndRef}></div>
            </div>
          </div>

          {match.mode === 'multi' && (
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-200 shadow-inner flex flex-col h-24">
              <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                <i className="fa-solid fa-comment-dots text-[10px]"></i>
                <span className="text-[8px] font-black uppercase tracking-widest">Chat</span>
              </div>
              <div className="flex-grow overflow-y-auto no-scrollbar space-y-0.5 mb-1">
                {match.chat?.slice(-2).map((c: any, i: number) => (
                  <p key={i} className="text-[8px] font-bold text-slate-600 leading-tight"><span className="text-slate-400">{c.user}:</span> {c.text}</p>
                ))}
              </div>
              <input 
                type="text" 
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold outline-none focus:border-amber-500"
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fila de Héroes */}
      <div className="grid grid-cols-3 gap-2 px-2 mb-2">
        {match.players.map((p: any, idx: number) => (
          <div 
            key={p.uid} 
            onClick={() => targeting?.ability.type === 'Support' && targeting?.ability.id !== 'distraction_shot' && p.hp > 0 && useAbility(targeting.ability, p.uid)}
            className={`bg-slate-900 text-white p-2 rounded-xl border-b-4 transition-all relative ${p.uid === match.activeTurnUid ? 'border-amber-500 ring-4 ring-amber-500/30 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)] z-10' : 'border-slate-950 opacity-80'} ${targeting?.ability.type === 'Support' && targeting?.ability.id !== 'distraction_shot' && p.hp > 0 ? 'cursor-pointer ring-2 ring-emerald-400/50 hover:bg-slate-800' : ''} ${animatingHero === p.uid ? 'animate-bounce-atk' : ''} ${hitHeroes[p.uid] ? 'animate-hit' : ''}`}
          >
             {p.uid === match.activeTurnUid && (
               <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg animate-pulse z-20 whitespace-nowrap border border-white/20">
                 <i className="fa-solid fa-caret-down mr-1"></i>
                 Turno Activo
               </div>
             )}
             <div className="flex flex-col items-center text-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-inner mb-1.5 ${p.hp > 0 ? 'bg-slate-800' : 'bg-red-900/50 grayscale relative'}`}>
                   <i className={`fa-solid ${CLASSES[p.classType].icon} ${p.hp > 0 ? 'text-white' : 'text-red-400'}`}></i>
                   {p.hp <= 0 && <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-xmark text-red-500 text-xs"></i></div>}
                </div>
                <div className="w-full">
                   <h4 className={`text-[8px] font-black uppercase tracking-widest mb-1 ${p.hp > 0 ? 'text-amber-500' : 'text-red-500'}`}>{p.hp > 0 ? `HÉROE ${idx + 1}` : 'ELIMINADO'}</h4>
                   <div className="flex justify-center gap-1 mb-1">
                      <div className="flex items-center gap-0.5" title="Vida">
                         <i className="fa-solid fa-heart text-red-500 text-[8px]"></i>
                         <span className="text-[10px] font-black">{p.hp}</span>
                      </div>
                      <div className="flex items-center gap-0.5" title="Ataque">
                         <i className="fa-solid fa-hand-fist text-orange-500 text-[8px]"></i>
                         <span className="text-[10px] font-black">{(CLASSES[p.classType]?.baseAtk || 0) + getExtraStats(p).extraPower}</span>
                      </div>
                      <div className="flex items-center gap-0.5" title="Defensa">
                         <i className="fa-solid fa-shield text-slate-400 text-[8px]"></i>
                         <span className="text-[10px] font-black">{(CLASSES[p.classType]?.def || 0) + getExtraStats(p).extraDef}</span>
                      </div>
                      <div className="flex items-center gap-0.5" title="Puntos de Acción">
                         <i className="fa-solid fa-bolt text-amber-500 text-[8px]"></i>
                         <span className="text-[10px] font-black">{p.pa}</span>
                      </div>
                   </div>
                   <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-500" style={{ width: `${(p.hp / (p.maxHp || CLASSES[p.classType].hp)) * 100}%` }}></div>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Slots de Equipamento */}
      <div className="grid grid-cols-3 gap-2 px-2 mb-3">
        {match.players.map((p: any) => (
          <div key={`equip-${p.uid}`} className="flex justify-center gap-1.5">
            {EQUIPMENT_SLOTS.map((slot, idx) => {
              const item = p.equipment?.[idx];
              const isMyHero = p.ownerUid === user.uid;
              return (
                <div 
                  key={slot.id} 
                  onClick={() => {
                    if (isMyHero && item && !match.enemy) {
                      playSound(SOUNDS.CLICK);
                      unequipItem(p.uid, idx);
                    }
                  }}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs shadow-inner transition-all ${item ? (match.enemy ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-900 border-slate-700 text-amber-400 cursor-pointer hover:scale-105') : 'bg-slate-50 border-slate-200 text-slate-300'}`}
                >
                  <i className={`fa-solid ${item ? item.icon : slot.icon}`}></i>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Barra de Habilidades */}
      <div className={`mx-2 p-2 rounded-xl flex justify-between items-center mb-3 border transition-all duration-500 shadow-sm ${isMyTurn ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/10' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`fantasy-font px-1 uppercase tracking-[0.1em] text-[10px] font-bold ${isMyTurn ? 'text-amber-600' : 'text-slate-400'}`}>
            {isMyTurn ? 'TU TURNO' : 'HABILIDADES'}
          </span>
          {isMyTurn && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>}
          {targeting && (
            <button 
              onClick={() => setTargeting(null)}
              className="bg-red-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {myP && myP.hp > 0 ? CLASSES[myP.classType]?.abilities.map((ability: any) => {
            const cd = myP.cooldowns?.[ability.id] || 0;
            return (
              <button 
                key={ability.id}
                disabled={!isMyTurn || (myP?.pa ?? 0) < ability.cost || (!match.enemy && ability.type === 'Attack') || cd > 0}
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  if (ability.type === 'Support') {
                    if (ability.id === 'distraction_shot') {
                      useAbility(ability);
                    } else {
                      setTargeting({ ability });
                    }
                  } else {
                    useAbility(ability);
                  }
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all border-2 relative ${targeting?.ability.id === ability.id ? 'bg-emerald-500 border-white scale-110 ring-2 ring-emerald-400/30' : (isMyTurn && (myP?.pa ?? 0) >= ability.cost && cd === 0 ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-slate-200 border-slate-100 opacity-50')}`}
              >
                <i className={`fa-solid ${ability.icon} text-sm`}></i>
                {cd > 0 && (
                  <div className="absolute inset-0 bg-slate-900/70 rounded-full flex items-center justify-center text-[9px] font-black">
                    {cd}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-slate-900 shadow-sm">
                  {ability.cost}
                </div>
              </button>
            );
          }) : (
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">
              {myP && myP.hp <= 0 ? 'Héroe Caído' : 'Turno ajeno'}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Inventario y Pasar Turno */}
      <div className="flex gap-3 px-2 pb-4 h-16">
        <button 
          onClick={() => { playSound(SOUNDS.CLICK); setShowInventory(true); }}
          className="flex-1 bg-white border-2 border-[#d4a373]/30 rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all"
        >
          <span className="fantasy-font text-slate-900 text-base uppercase tracking-widest">Inventario</span>
        </button>
        
        <button 
          onClick={() => { playSound(SOUNDS.CLICK); endTurn(); }}
          disabled={!isMyTurn}
          className={`flex-1 bg-[#fdf6e3] border-2 border-[#d4a373] rounded-xl flex items-center justify-center shadow-md transition-all relative group ${isMyTurn ? 'active:scale-95' : 'opacity-50 grayscale'}`}
        >
           <div className="text-center">
              <p className="fantasy-font text-slate-900 text-lg leading-none uppercase tracking-tighter">PASAR</p>
              <p className="text-[8px] font-black text-[#d4a373] uppercase tracking-[0.1em] mt-0.5">TURNO</p>
           </div>
        </button>
      </div>

      {/* Modal de Inventario */}
      {showInventory && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 relative overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
            <button onClick={() => { playSound(SOUNDS.CLICK); setShowInventory(false); }} className="absolute top-4 right-4 text-slate-300 hover:text-slate-900 transition-colors">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
                <i className="fa-solid fa-backpack"></i>
              </div>
              <div className="text-left">
                <h2 className="fantasy-font text-2xl text-slate-900 uppercase tracking-tighter">Inventario</h2>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mochila Compartida</p>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto no-scrollbar space-y-4 pr-1">
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 mb-4">
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-circle-info"></i>
                  Objetos disponibles para el equipo
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {match.sharedInventory?.length > 0 ? match.sharedInventory.map((item: any, i: number) => (
                    <div key={`shared-inv-${i}`} className="bg-white p-3 rounded-xl border border-amber-200/50 flex gap-3 items-center shadow-sm">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-sm">
                        <i className={`fa-solid ${item.icon} text-lg`}></i>
                      </div>
                      <div className="text-left flex-grow">
                        <p className="text-[10px] font-black uppercase text-slate-900">{item.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">
                          {item.power ? `Poder: +${item.power} ` : ''}
                          {item.def ? `Def: +${item.def} ` : ''}
                          {item.hp ? `Vida: +${item.hp} ` : ''}
                          {item.heal ? `Cura: ${item.heal} ` : ''}
                          • {item.type}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {match.players.filter((p: any) => p.ownerUid === user.uid && p.hp > 0).map((p: any) => (
                          <button 
                            key={p.uid}
                            onClick={() => {
                              playSound(SOUNDS.CLICK);
                              if (item.type === 'Usable') useItem(p.uid, item);
                              else {
                                const slotIdx = EQUIPMENT_SLOTS.findIndex(s => s.type === item.type);
                                equipItem(p.uid, item, slotIdx);
                              }
                            }}
                            disabled={item.type !== 'Usable' && !!match.enemy}
                            className={`text-white text-[7px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors ${item.type === 'Usable' ? 'bg-emerald-600 hover:bg-emerald-500' : (match.enemy ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-amber-500')}`}
                          >
                            {item.type === 'Usable' ? 'Usar' : 'Equipar'} {p.name.split(' ')[1] || p.name.split('(')[1]?.replace(')', '') || ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <p className="text-[8px] font-bold text-slate-300 uppercase text-center py-2">Mochila vacía</p>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => { playSound(SOUNDS.CLICK); setShowInventory(false); }} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest">Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal de Votación */}
      {match.pendingAction && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-xs overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-amber-500 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className={`fa-solid ${match.pendingAction.item.icon} text-3xl text-white`}></i>
              </div>
              <h3 className="fantasy-font text-xl text-white uppercase">Votación Grupal</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-slate-600 text-[11px] font-bold mb-4">
                <span className="text-amber-600">{match.pendingAction.requesterName}</span> quiere {match.pendingAction.type === 'equip' ? 'equipar' : 'usar'} <span className="text-slate-900">{match.pendingAction.item.name}</span>.
              </p>
              
              <div className="flex flex-col gap-2 mb-6">
                <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Votos de compañeros</div>
                <div className="flex justify-center gap-2">
                  {match.players.filter((p: any) => p.uid !== match.pendingAction.playerUid).map((p: any) => (
                    <div key={p.uid} className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 ${match.votes?.[p.uid] === true ? 'bg-emerald-50 border-emerald-500 text-emerald-500' : match.votes?.[p.uid] === false ? 'bg-red-50 border-red-500 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                      <i className={`fa-solid ${match.votes?.[p.uid] === true ? 'fa-check' : match.votes?.[p.uid] === false ? 'fa-xmark' : 'fa-hourglass-start'} text-[10px]`}></i>
                    </div>
                  ))}
                </div>
              </div>

              {user.uid !== match.pendingAction.playerUid ? (
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleVote(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-400 font-black uppercase text-[9px] hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    Rechazar
                  </button>
                  <button 
                    onClick={() => handleVote(true)}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-black uppercase text-[9px] shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition-all"
                  >
                    Aprobar
                  </button>
                </div>
              ) : (
                <div className="py-3 px-4 bg-amber-50 rounded-xl border border-amber-100 text-[9px] font-bold text-amber-700 animate-pulse">
                  Esperando aprobación del grupo...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lobby' | 'campaign' | 'individual' | 'multi_menu' | 'difficulty' | 'hero_selection' | 'lobby_waiting' | 'game'>('lobby');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [mode, setMode] = useState<'campaign' | 'individual' | 'multi'>('individual');
  const [difficulty, setDifficulty] = useState('Normal');
  const [joinCode, setJoinCode] = useState('');
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [viewingAbilities, setViewingAbilities] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const initMatch = async (diff: string) => {
    if (!user) return;
    setDifficulty(diff);
    try {
      if (mode === 'multi') {
        const code = generateRoomCode();
        const mission = GROUP_MISSIONS[Math.floor(Math.random() * GROUP_MISSIONS.length)];
        await safeSetDoc(doc(db, 'matches', code), { 
          hostId: user.uid, status: 'waiting', difficulty: diff, mode: 'multi', 
          players: [{ uid: user.uid, name: user.email?.split('@')[0], classType: null, isReady: false, role: 'host' }], 
          sharedInventory: [ITEMS[3], ITEMS[3], ITEMS[3]],
          chat: [], log: ["Invocación lista."], createdAt: Date.now(),
          deckRemaining: DIFFICULTY_CONFIG[diff],
          mission: { ...mission, progress: 0, completed: false }
        });
        setMatchId(code);
        setView('lobby_waiting');
      } else {
        setView('hero_selection');
      }
    } catch (error: any) {
      console.error("Error initializing match:", error);
      if (error.message.includes("permissions")) {
        alert("Error de permisos en Firestore. Asegúrate de configurar las reglas de seguridad.");
      } else {
        alert("Error al crear la partida: " + error.message);
      }
    }
  };

  const finalizeSolo = async (classTypes: string[]) => {
    if (!user) return;
    const code = generateRoomCode();
    const initialDeckSize = DIFFICULTY_CONFIG[difficulty];
    try {
      const players = classTypes.map((ct, i) => {
        const mission = INDIVIDUAL_MISSIONS[Math.floor(Math.random() * INDIVIDUAL_MISSIONS.length)];
        return {
          uid: `${user.uid}-${i}`,
          ownerUid: user.uid,
          name: `${user.email?.split('@')[0]} (${ct})`,
          classType: ct,
          isReady: true,
          role: i === 0 ? 'host' : 'guest',
          hp: CLASSES[ct].hp,
          maxHp: CLASSES[ct].hp,
          pa: 6,
          maxPa: 6,
          extraAtk: 0,
          cooldowns: {},
          shield: 0,
          intervenedBy: null,
          distracted: false,
          equipment: [null, null, null],
          bottomInventory: [],
          individualMission: {
            ...mission,
            progress: 0,
            status: 'active',
            deadlineCard: 5
          }
        };
      });
      const turnOrder = players.map(p => p.uid);
      const mission = GROUP_MISSIONS[Math.floor(Math.random() * GROUP_MISSIONS.length)];
      await safeSetDoc(doc(db, 'matches', code), { 
        hostId: user.uid, status: 'combat', difficulty, mode, 
        players, 
        sharedInventory: [ITEMS[3], ITEMS[3], ITEMS[3]],
        turnOrder, activeTurnUid: turnOrder[0], phase: 'players', playersReadyForNext: [], log: ["Senda solitaria iniciada."], createdAt: Date.now(),
        deckRemaining: initialDeckSize,
        mission: { ...mission, progress: 0, completed: false }
      });
      setMatchId(code);
      setView('game');
    } catch (error: any) {
      console.error("Error finalizing solo match:", error);
      alert("Error al iniciar partida individual: " + error.message);
    }
  };

  const joinMatch = async () => {
    const code = joinCode.toUpperCase().trim();
    try {
      const snap = await getDoc(doc(db, 'matches', code));
      if (snap.exists() && snap.data().players.length < 3) {
        const p = { uid: user?.uid, name: user?.email?.split('@')[0], classType: null, isReady: false, role: 'guest' };
        const currentPlayers = snap.data().players;
        if (!currentPlayers.find((existing: any) => existing.uid === user?.uid)) {
          await safeUpdateDoc(doc(db, 'matches', code), { players: [...currentPlayers, p] });
        }
        setMatchId(code);
        setView('lobby_waiting');
      } else { alert("Sala no válida o llena"); }
    } catch (error: any) {
      console.error("Error joining match:", error);
      if (error.message.includes("permissions")) {
        alert("Error de permisos en Firestore. Asegúrate de configurar las reglas de seguridad.");
      } else {
        alert("Error al unirse a la sala: " + error.message);
      }
    }
  };

  const renderContent = () => {
    if (loading) return <div className="min-h-screen bg-white flex flex-col items-center justify-center fantasy-font text-2xl uppercase tracking-[0.2em] animate-pulse text-slate-900">Invocando Reinos...</div>;
    
    if (!user) return <AuthScreen />;

    if (view === 'lobby_waiting' && matchId) return <LobbyWaiting matchId={matchId} user={user} onStart={() => setView('game')} onLeave={() => { setMatchId(null); setView('lobby'); }} />;
    if (view === 'game' && matchId) return <GameBoard matchId={matchId} user={user} onLeave={() => { setMatchId(null); setView('lobby'); }} />;

    return (
      <div className="min-h-screen bg-white p-4 flex flex-col items-center justify-center text-center animate-fade-in">
        {view === 'lobby' && (
          <>
            <h1 className="text-5xl fantasy-font text-slate-900 mb-1 uppercase tracking-tighter">SHUFFLE RAID</h1>
            <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.4em] mb-12">Estrategia y Mazo v3.0</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { playSound(SOUNDS.CLICK); setMode('campaign'); setView('campaign'); }} className="w-full bg-slate-900 text-white py-4 rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Campaña</button>
              <button onClick={() => { playSound(SOUNDS.CLICK); setMode('individual'); setView('individual'); }} className="w-full bg-slate-50 border border-slate-100 py-4 rounded-[28px] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Individual</button>
              <button onClick={() => { playSound(SOUNDS.CLICK); setMode('multi'); setView('multi_menu'); }} className="w-full bg-slate-50 border border-slate-100 py-4 rounded-[28px] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Multijugador</button>
              <button onClick={() => { playSound(SOUNDS.CLICK); signOut(auth); }} className="mt-8 text-slate-300 font-black uppercase text-[8px] tracking-[0.3em] hover:text-red-400 transition-colors">Desconectar</button>
            </div>
          </>
        )}

        {view === 'campaign' && (
          <SubMenuLayout title="Campaña" subtitle="El Despertar del Caos" onBack={() => setView('lobby')}>
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-4">
               <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">Un antiguo mal despierta en Shuffle. Solo los más sabios estrategas podrán sellar la brecha del vacío.</p>
            </div>
            <button onClick={() => { playSound(SOUNDS.CLICK); setView('difficulty'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95">Iniciar Aventura</button>
          </SubMenuLayout>
        )}

        {view === 'individual' && (
          <SubMenuLayout title="Individual" subtitle="Senda del Guerrero Solitario" onBack={() => setView('lobby')}>
            <button onClick={() => { playSound(SOUNDS.CLICK); setView('difficulty'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95">Entrar al Calabozo</button>
          </SubMenuLayout>
        )}

        {view === 'multi_menu' && (
          <SubMenuLayout title="Multijugador" subtitle="Gremio de Incursores" onBack={() => setView('lobby')}>
            <button onClick={() => { playSound(SOUNDS.CLICK); setView('difficulty'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg mb-3">Crear Grupo</button>
            <div className="pt-6 border-t border-slate-100 mt-3">
               <input type="text" placeholder="ID SALA" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-[24px] text-[11px] font-black text-center mb-3 outline-none focus:border-amber-400 uppercase tracking-[0.2em] fantasy-font" value={joinCode} onChange={e => setJoinCode(e.target.value.slice(0,5))} />
               <button onClick={() => { playSound(SOUNDS.CLICK); joinMatch(); }} disabled={joinCode.length < 5} className="w-full bg-slate-50 text-slate-900 py-4 rounded-[24px] font-black uppercase text-[9px] tracking-widest border border-slate-100 active:scale-95 transition-all">Unirse</button>
            </div>
          </SubMenuLayout>
        )}

        {view === 'difficulty' && (
          <SubMenuLayout title="Dificultad" subtitle="Balance de Riesgo" onBack={() => setView('lobby')}>
            {Object.keys(DIFFICULTY_CONFIG).map(d => (
              <button key={d} onClick={() => { playSound(SOUNDS.CLICK); initMatch(d); }} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] font-black hover:border-amber-400 hover:bg-white transition-all uppercase tracking-widest shadow-sm">{d}</button>
            ))}
          </SubMenuLayout>
        )}

        {view === 'hero_selection' && (
          <SubMenuLayout title="Tu Equipo" subtitle={`Selecciona 3 héroes (${selectedHeroes.length}/3)`} onBack={() => { setView('difficulty'); setSelectedHeroes([]); }}>
            <div className="flex gap-3 mb-6 justify-center">
              {[0, 1, 2].map(i => (
                <div 
                  key={i} 
                  onClick={() => {
                    if (selectedHeroes[i]) {
                      const next = [...selectedHeroes];
                      next.splice(i, 1);
                      setSelectedHeroes(next);
                    }
                  }}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${selectedHeroes[i] ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-110' : 'border-slate-200 text-slate-200 border-dashed'}`}
                >
                  {selectedHeroes[i] ? <i className={`fa-solid ${CLASSES[selectedHeroes[i]].icon} text-xl`}></i> : <i className="fa-solid fa-plus text-xs"></i>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 w-full mb-6">
              {Object.keys(CLASSES).map(key => (
                <div key={key} className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (selectedHeroes.length < 3) {
                        setSelectedHeroes([...selectedHeroes, key]);
                      }
                    }} 
                    disabled={selectedHeroes.length >= 3}
                    className={`flex-grow flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-[24px] hover:border-amber-400 hover:bg-white group active:scale-95 transition-all shadow-sm ${selectedHeroes.length >= 3 ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-lg shadow-lg group-hover:scale-110 transition-transform"><i className={`fa-solid ${CLASSES[key].icon}`}></i></div>
                    <div className="text-left flex-grow">
                      <h3 className="fantasy-font text-sm text-slate-900 uppercase tracking-tighter">{key}</h3>
                      <div className="flex gap-2 mt-1">
                        <div className="flex items-center gap-0.5" title="Vida">
                          <i className="fa-solid fa-heart text-red-500 text-[6px]"></i>
                          <span className="text-[7px] font-black text-slate-600">{CLASSES[key].hp}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="Ataque">
                          <i className="fa-solid fa-hand-fist text-orange-500 text-[6px]"></i>
                          <span className="text-[7px] font-black text-slate-600">{CLASSES[key].baseAtk}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="Defensa">
                          <i className="fa-solid fa-shield text-slate-400 text-[6px]"></i>
                          <span className="text-[7px] font-black text-slate-600">{CLASSES[key].def}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <button 
                    onClick={() => setViewingAbilities(key)}
                    className="w-12 bg-slate-100 text-slate-400 rounded-[20px] flex items-center justify-center hover:bg-slate-900 hover:text-white transition-colors border border-slate-200"
                  >
                    <i className="fa-solid fa-book-sparkles text-sm"></i>
                  </button>
                </div>
              ))}
            </div>

            {selectedHeroes.length === 3 && (
              <button 
                onClick={() => {
                  finalizeSolo(selectedHeroes);
                  setSelectedHeroes([]);
                }}
                className="w-full bg-emerald-500 text-white py-4 rounded-[24px] font-black uppercase text-[10px] tracking-[0.1em] shadow-xl animate-bounce-subtle active:scale-95 transition-all"
              >
                Confirmar Equipo
              </button>
            )}

            {viewingAbilities && (
              <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-sm rounded-[32px] p-6 relative overflow-hidden shadow-2xl">
                  <button onClick={() => setViewingAbilities(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-900 transition-colors">
                    <i className="fa-solid fa-xmark text-xl"></i>
                  </button>
                  
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
                      <i className={`fa-solid ${CLASSES[viewingAbilities].icon}`}></i>
                    </div>
                    <div className="text-left">
                      <h2 className="fantasy-font text-2xl text-slate-900 uppercase tracking-tighter">{viewingAbilities}</h2>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Habilidades</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {CLASSES[viewingAbilities].abilities.map((ability: any) => (
                      <div key={ability.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex gap-3 items-center">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 shadow-sm border border-slate-100">
                          <i className={`fa-solid ${ability.icon} text-sm`}></i>
                        </div>
                        <div className="text-left flex-grow">
                          <div className="flex justify-between items-center mb-0.5">
                            <p className="text-[9px] font-black uppercase text-slate-900">{ability.name}</p>
                            <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase">{ability.cost} PA</span>
                          </div>
                          <p className="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">{ability.desc || `Poder: ${ability.power} • CD: ${ability.cooldown}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setViewingAbilities(null)} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest">Cerrar</button>
                </div>
              </div>
            )}
          </SubMenuLayout>
        )}
      </div>
    );
  };

  return (
    <div className="game-wrapper">
      {renderContent()}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);