import React, { useState, useEffect, useRef } from 'react';
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
  getDoc,
  setDoc,
  deleteDoc,
  increment
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

// --- CONSTANTES ---
const CLASSES: Record<string, any> = {
  Warrior: { 
    hp: 25, def: 3, baseAtk: 4, icon: 'fa-shield-halved', color: 'amber',
    abilities: [
      { id: 'strike', name: 'Golpe Letal', type: 'Attack', cost: 2, cooldown: 0, power: 6, icon: 'fa-sword' },
      { id: 'rally', name: 'Grito de Guerra', type: 'Support', cost: 3, cooldown: 2, power: 5, desc: 'Cura HP a un aliado', icon: 'fa-bullhorn' },
      { id: 'protect', name: 'Escudo Mural', type: 'Support', cost: 2, cooldown: 2, power: 3, desc: 'Aumenta defensa temporalmente', icon: 'fa-shield' }
    ]
  },
  Mage: { 
    hp: 15, def: 1, baseAtk: 6, icon: 'fa-wand-sparkles', color: 'blue',
    abilities: [
      { id: 'fireball', name: 'Bola de Fuego', type: 'Attack', cost: 3, cooldown: 0, power: 10, icon: 'fa-fire' },
      { id: 'arcane_shield', name: 'Velo Arcano', type: 'Support', cost: 2, cooldown: 2, power: 4, desc: 'Escudo de energía', icon: 'fa-hand-sparkles' },
      { id: 'blink', name: 'Traslación', type: 'Support', cost: 1, cooldown: 1, power: 0, desc: 'Esquiva próximo ataque', icon: 'fa-bolt-lightning' }
    ]
  },
  Hunter: { 
    hp: 20, def: 2, baseAtk: 5, icon: 'fa-crosshairs', color: 'emerald',
    abilities: [
      { id: 'shot', name: 'Flecha Certera', type: 'Attack', cost: 2, cooldown: 0, power: 7, icon: 'fa-location-arrow' },
      { id: 'herbs', name: 'Hierbas Curativas', type: 'Support', cost: 2, cooldown: 1, power: 4, desc: 'Cura HP moderado', icon: 'fa-leaf' },
      { id: 'trap', name: 'Trampa de Osos', type: 'Attack', cost: 3, cooldown: 3, power: 5, desc: 'Aturde al enemigo', icon: 'fa-link' }
    ]
  }
};

const ENEMIES = [
  { name: "Horda de Goblins", hp: 12, maxHp: 12, damage: 4, def: 1, icon: 'fa-users-viewfinder' },
  { name: "Ogro del Pantano", hp: 25, maxHp: 25, damage: 8, def: 2, icon: 'fa-hand-fist' },
  { name: "Gólem Arcano", hp: 35, maxHp: 35, damage: 6, def: 4, icon: 'fa-mountain' },
  { name: "Lamía Seductora", hp: 28, maxHp: 28, damage: 5, def: 2, icon: 'fa-staff-snake' }
];

// --- COMPONENTES ---

function SubMenuLayout({ title, subtitle, onBack, children }: { title: string, subtitle: string, onBack: () => void, children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center animate-fade-in">
      <button onClick={onBack} className="self-start mb-6 text-slate-300 hover:text-slate-900 flex items-center gap-2 font-black text-[10px] tracking-[0.3em] uppercase transition-colors">
        <i className="fa-solid fa-arrow-left"></i> Volver
      </button>
      <h1 className="text-3xl text-slate-900 fantasy-font mb-1 uppercase tracking-tighter text-center">{title}</h1>
      <p className="text-slate-400 mb-10 tracking-[0.2em] uppercase text-[9px] font-black text-center">{subtitle}</p>
      <div className="w-full max-w-xs space-y-3">{children}</div>
    </div>
  );
}

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <h1 className="text-5xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
      <p className="text-slate-400 mb-12 uppercase tracking-[0.4em] text-[10px] font-black">Multiplayer RPG Edition</p>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        <input type="email" placeholder="EMAIL" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">CONECTAR</button>
      </form>
      <button onClick={() => setIsReg(!isReg)} className="mt-8 text-slate-400 text-[9px] font-black tracking-widest uppercase">{isReg ? 'Tengo cuenta' : 'Nuevo héroe'}</button>
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
    const updatedPlayers = match.players.map((p: any) => 
      p.uid === user.uid ? { ...p, classType, isReady: false, hp: CLASSES[classType].hp, pa: 5, cooldowns: {} } : p
    );
    await updateDoc(doc(db, 'matches', matchId), { players: updatedPlayers });
  };

  const toggleReady = async () => {
    if (!myPlayer.classType) return;
    const updatedPlayers = match.players.map((p: any) => 
      p.uid === user.uid ? { ...p, isReady: !p.isReady } : p
    );
    await updateDoc(doc(db, 'matches', matchId), { players: updatedPlayers });
  };

  const startCombat = async () => {
    if (!isHost || !allReady) return;
    const order = shuffleArray(match.players.map((p: any) => p.uid));
    await updateDoc(doc(db, 'matches', matchId), { 
      status: 'combat', 
      turnOrder: order, 
      activeTurnUid: order[0],
      phase: 'players',
      playersReadyForNext: []
    });
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    await updateDoc(doc(db, 'matches', matchId), {
      chat: arrayUnion({ user: user.email?.split('@')[0], text: msg, time: Date.now() })
    });
    setMsg('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onLeave} className="text-slate-300 font-black text-[10px] uppercase tracking-widest hover:text-red-500">Salir</button>
        <div className="bg-slate-50 px-5 py-2 rounded-full border border-slate-100 flex items-center gap-3">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</span>
           <span className="text-[12px] fantasy-font font-bold text-slate-900 tracking-wider">{matchId.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-6 overflow-hidden">
        <div className="space-y-3">
          {match.players.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 relative">
              <div className={`w-12 h-12 ${p.classType ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-200 text-slate-400'} rounded-2xl flex items-center justify-center text-xl transition-all`}>
                <i className={`fa-solid ${p.classType ? CLASSES[p.classType].icon : 'fa-user-clock'}`}></i>
              </div>
              <div className="flex-grow">
                <p className="text-[10px] font-black uppercase text-slate-900">{p.name} {p.role === 'host' && '👑'}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p.classType || 'Eligiendo...'}</p>
              </div>
              {p.role !== 'host' && <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${p.isReady ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}><i className="fa-solid fa-check text-[10px]"></i></div>}
            </div>
          ))}
          {Array.from({ length: 3 - match.players.length }).map((_, i) => (
             <div key={i} className="border-2 border-dashed border-slate-100 p-4 rounded-3xl flex items-center justify-center text-[9px] font-black text-slate-100 uppercase tracking-widest">Vacante</div>
          ))}
        </div>

        {!myPlayer?.isReady && (
          <div className="grid grid-cols-3 gap-3">
            {Object.keys(CLASSES).map(key => {
              const isTaken = takenClasses.includes(key);
              const isMine = myPlayer.classType === key;
              return (
                <button key={key} onClick={() => selectHero(key)} disabled={isTaken && !isMine} className={`flex flex-col items-center justify-center p-4 rounded-3xl border transition-all ${isMine ? 'bg-slate-900 border-slate-900 text-white scale-105 shadow-xl' : (isTaken ? 'opacity-30 border-slate-100 grayscale cursor-not-allowed' : 'bg-white border-slate-100 text-slate-400 hover:border-amber-400')}`}>
                  <i className={`fa-solid ${CLASSES[key].icon} text-xl mb-2`}></i>
                  <span className="text-[7px] font-black uppercase">{key}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-grow bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col overflow-hidden shadow-inner p-4">
           <div className="flex-grow overflow-y-auto no-scrollbar space-y-3 p-2">
            {match.chat?.map((c: any, i: number) => (
              <div key={i} className={`flex flex-col ${c.user === user.email?.split('@')[0] ? 'items-end' : 'items-start'}`}>
                <div className="bg-white px-4 py-2 rounded-[18px] border border-slate-100 text-[10px] font-bold text-slate-700 shadow-sm max-w-[85%]">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input type="text" placeholder="Habla con tu equipo..." className="flex-grow bg-white px-4 py-3 rounded-xl text-[10px] outline-none border border-slate-100" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fa-solid fa-paper-plane text-[10px]"></i></button>
          </div>
        </div>

        <button onClick={isHost ? startCombat : toggleReady} disabled={!myPlayer.classType || (isHost && (!allReady || match.players.length < (match.mode === 'multi' ? 2 : 1)))} className={`w-full py-5 rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${myPlayer.isReady || (isHost && allReady) ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white disabled:opacity-30'}`}>
          {isHost ? 'Empezar Incursión' : (myPlayer.isReady ? '¡Listo!' : 'Confirmar Héroe')}
        </button>
      </div>
    </div>
  );
}

function GameBoard({ matchId, user, onLeave }: { matchId: string, user: User, onLeave: () => void }) {
  const [match, setMatch] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [targeting, setTargeting] = useState<any>(null); // { ability: {}, callback: func }
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (!snap.exists()) { onLeave(); return; }
      setMatch(snap.data());
    });
  }, [matchId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [match?.log]);

  if (!match) return null;

  const myP = match.players.find((p: any) => p.uid === user.uid);
  const isMyTurn = match.activeTurnUid === user.uid && match.phase === 'players';
  const myReadyToAdvance = match.playersReadyForNext?.includes(user.uid);
  const isHost = myP?.role === 'host';

  const useAbility = async (ability: any, targetUid?: string) => {
    if (!isMyTurn || myP.pa < ability.cost) return;

    let updatedPlayers = [...match.players];
    let updatedEnemy = match.enemy ? { ...match.enemy } : null;
    let logMsg = "";

    if (ability.type === 'Attack' && updatedEnemy) {
      const damage = Math.max(1, ability.power - updatedEnemy.def);
      updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
      logMsg = `${myP.name} usa ${ability.name} contra ${updatedEnemy.name} causando ${damage} de daño.`;
    } else if (ability.type === 'Support' && targetUid) {
      const targetPlayerIdx = updatedPlayers.findIndex(p => p.uid === targetUid);
      const targetPlayer = updatedPlayers[targetPlayerIdx];
      if (ability.id === 'rally' || ability.id === 'herbs') {
        targetPlayer.hp = Math.min(CLASSES[targetPlayer.classType].hp, targetPlayer.hp + ability.power);
        logMsg = `${myP.name} usa ${ability.name} sobre ${targetPlayer.name} sanando ${ability.power} HP.`;
      } else if (ability.id === 'protect' || ability.id === 'arcane_shield') {
        targetPlayer.pa = Math.min(5, targetPlayer.pa + 2); // Buff de PA en esta versión simplificada
        logMsg = `${myP.name} refuerza a ${targetPlayer.name} con ${ability.name}.`;
      }
    }

    // Actualizar mi propio estado
    const meIdx = updatedPlayers.findIndex(p => p.uid === user.uid);
    updatedPlayers[meIdx].pa -= ability.cost;
    updatedPlayers[meIdx].cooldowns[ability.id] = ability.cooldown;

    const updates: any = { players: updatedPlayers, log: arrayUnion(logMsg) };
    if (updatedEnemy) {
      updates.enemy = updatedEnemy;
      if (updatedEnemy.hp === 0) {
        updates.enemy = null;
        updates.log = arrayUnion(`¡${updatedEnemy.name} ha sido derrotado!`);
        updates.playersReadyForNext = [];
      }
    }

    await updateDoc(doc(db, 'matches', matchId), updates);
    setTargeting(null);
  };

  const endTurn = async () => {
    const currentIndex = match.turnOrder.indexOf(user.uid);
    const nextIndex = currentIndex + 1;
    const updates: any = {};
    
    if (nextIndex < match.turnOrder.length) {
      updates.activeTurnUid = match.turnOrder[nextIndex];
    } else {
      updates.phase = 'enemy';
      // Simular ataque enemigo (lo hace el Host)
      if (isHost && match.enemy) {
        setTimeout(async () => {
          const targetPIdx = Math.floor(Math.random() * match.players.length);
          const enemyDmg = Math.max(1, match.enemy.damage - match.players[targetPIdx].def);
          const newPlayers = [...match.players].map((p, i) => i === targetPIdx ? { ...p, hp: Math.max(0, p.hp - enemyDmg), pa: 5 } : { ...p, pa: 5 });
          await updateDoc(doc(db, 'matches', matchId), {
            players: newPlayers,
            phase: 'players',
            activeTurnUid: match.turnOrder[0],
            log: arrayUnion(`${match.enemy.name} ataca a ${match.players[targetPIdx].name} causando ${enemyDmg} daño.`)
          });
        }, 1000);
      }
    }
    await updateDoc(doc(db, 'matches', matchId), updates);
  };

  const toggleReadyToAdvance = async () => {
    const newList = myReadyToAdvance 
      ? match.playersReadyForNext.filter((id: string) => id !== user.uid)
      : [...(match.playersReadyForNext || []), user.uid];
    
    await updateDoc(doc(db, 'matches', matchId), { playersReadyForNext: newList });

    if (newList.length === match.players.length && isHost && !match.enemy) {
      const nextEnemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
      await updateDoc(doc(db, 'matches', matchId), { 
        enemy: { ...nextEnemy, hp: nextEnemy.hp, maxHp: nextEnemy.maxHp },
        log: arrayUnion(`Una nueva carta se revela: ¡${nextEnemy.name}!`),
        playersReadyForNext: []
      });
    }
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    await updateDoc(doc(db, 'matches', matchId), {
      chat: arrayUnion({ user: user.email?.split('@')[0], text: msg, time: Date.now() })
    });
    setMsg('');
  };

  const resetMatch = async () => {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'waiting',
      enemy: null,
      players: match.players.map((p: any) => ({ ...p, isReady: false, hp: CLASSES[p.classType].hp, pa: 5, cooldowns: {} })),
      log: ["Iniciando nueva ronda..."],
      playersReadyForNext: []
    });
  };

  const isDead = myP.hp <= 0;
  const allDead = match.players.every((p: any) => p.hp <= 0);

  if (allDead) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <i className="fa-solid fa-skull-crossbones text-6xl text-red-500 mb-6"></i>
        <h1 className="fantasy-font text-4xl text-white mb-2 uppercase">DERROTA</h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-12">El grupo ha perecido en la mazmorra</p>
        <div className="flex gap-4 w-full max-w-xs">
          <button onClick={onLeave} className="flex-grow bg-slate-800 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Salir</button>
          {isHost && <button onClick={resetMatch} className="flex-grow bg-white text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl">Reintentar</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header Heroes */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-100">
        {match.players.map((p: any) => (
          <div 
            key={p.uid} 
            onClick={() => targeting?.ability.type === 'Support' && useAbility(targeting.ability, p.uid)}
            className={`p-2 rounded-2xl border transition-all ${p.uid === match.activeTurnUid ? 'border-amber-400 bg-white ring-2 ring-amber-100' : 'border-slate-100 bg-slate-50'} ${targeting?.ability.type === 'Support' ? 'cursor-pointer hover:border-emerald-400 animate-pulse' : ''}`}
          >
            <div className="flex justify-between items-start mb-1">
              <i className={`fa-solid ${CLASSES[p.classType].icon} text-[10px] ${p.hp > 0 ? 'text-slate-900' : 'text-red-400'}`}></i>
              <span className="text-[7px] font-black uppercase text-slate-400">{p.name.slice(0,6)}</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(p.hp / CLASSES[p.classType].hp) * 100}%` }}></div>
            </div>
            <div className="flex gap-0.5 mt-1 justify-center">
              {[...Array(5)].map((_, i) => <div key={i} className={`w-1 h-1 rounded-full ${i < p.pa ? 'bg-amber-400' : 'bg-slate-300'}`}></div>)}
            </div>
          </div>
        ))}
      </div>

      {/* Main Encounter Area */}
      <div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden relative">
        <div className="flex-grow bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col items-center justify-center p-6 shadow-inner relative">
          {match.enemy ? (
            <div className="text-center animate-fade-in w-full">
              <div className="relative inline-block mb-4">
                <i className={`fa-solid ${match.enemy.icon} text-7xl text-slate-900 drop-shadow-xl`}></i>
                {match.phase === 'enemy' && <div className="absolute inset-0 bg-red-500/20 animate-ping rounded-full"></div>}
              </div>
              <h3 className="fantasy-font text-lg uppercase mb-1">{match.enemy.name}</h3>
              <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden mx-auto"><div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(match.enemy.hp / match.enemy.maxHp) * 100}%` }}></div></div>
              <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-widest">HP Enemigo: {match.enemy.hp}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-4 text-slate-200 text-6xl"><i className="fa-solid fa-layer-group"></i></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Mazo de Incursión</p>
              <label className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl border border-slate-200 cursor-pointer shadow-sm hover:border-amber-400 transition-all">
                <input type="checkbox" checked={myReadyToAdvance} onChange={toggleReadyToAdvance} className="w-5 h-5 accent-amber-500" />
                <span className="text-[10px] font-black uppercase text-slate-900">Listo para avanzar</span>
              </label>
              <div className="mt-4 flex gap-1 justify-center">
                {match.players.map((p: any) => (
                  <div key={p.uid} className={`w-2 h-2 rounded-full ${match.playersReadyForNext?.includes(p.uid) ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Combat Chat & Log Panel */}
        <div className="h-32 flex gap-2">
          <div className="flex-grow bg-white rounded-3xl border border-slate-100 p-3 overflow-y-auto no-scrollbar shadow-sm">
            {match.log?.slice(-10).map((l: string, i: number) => (
              <p key={i} className="text-[8px] font-bold text-slate-400 mb-1 border-l-2 border-amber-300 pl-2 italic">{l}</p>
            ))}
            <div ref={logEndRef}></div>
          </div>
          <div className="w-24 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col p-2 overflow-hidden shadow-inner">
             <div className="flex-grow overflow-y-auto no-scrollbar text-[7px] font-bold text-slate-500 space-y-1">
                {match.chat?.slice(-5).map((c: any, i: number) => (
                  <div key={i} className="truncate"><span className="text-slate-900">{c.user}:</span> {c.text}</div>
                ))}
             </div>
             <input type="text" className="mt-1 w-full bg-white text-[7px] p-1 rounded-lg border-none" placeholder="..." onKeyDown={e => { if(e.key==='Enter') { sendMessage(); (e.target as any).value = ''; } }} onChange={e => setMsg(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={`p-4 ${isDead ? 'bg-slate-100' : 'bg-slate-900'} rounded-t-[40px] shadow-2xl transition-colors`}>
        {isDead ? (
           <div className="h-28 flex items-center justify-center"><span className="text-[10px] font-black text-slate-400 uppercase">Estás fuera de combate</span></div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">PA: {myP.pa}</span>
                <div className="flex gap-1">{[...Array(5)].map((_, i) => <div key={i} className={`w-2 h-2 rounded-sm rotate-45 ${i < myP.pa ? 'bg-amber-400' : 'bg-slate-700'}`}></div>)}</div>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isMyTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {isMyTurn ? 'Tu Turno' : `Turno de ${match.players.find((p:any)=>p.uid === match.activeTurnUid)?.name}`}
              </span>
            </div>
            <div className="flex gap-2 h-24">
              {CLASSES[myP.classType].abilities.map((ability: any) => (
                <button 
                  key={ability.id} 
                  disabled={!isMyTurn || myP.pa < ability.cost || !match.enemy && ability.type === 'Attack' || targeting?.ability.id === ability.id}
                  onClick={() => ability.type === 'Support' ? setTargeting({ ability }) : useAbility(ability)}
                  className={`flex-grow rounded-3xl flex flex-col items-center justify-center p-2 relative border border-white/5 transition-all ${targeting?.ability.id === ability.id ? 'bg-emerald-500 scale-95 shadow-inner' : 'bg-slate-800'}`}
                >
                  <i className={`fa-solid ${ability.icon} text-lg mb-1 text-amber-500`}></i>
                  <span className="text-[7px] font-black text-white uppercase truncate w-full text-center">{ability.name}</span>
                  <span className="text-[6px] font-bold text-slate-400">{ability.cost} PA</span>
                </button>
              ))}
              <button onClick={endTurn} disabled={!isMyTurn} className="w-14 bg-white rounded-3xl flex flex-col items-center justify-center text-slate-900 shadow-xl disabled:opacity-30"><i className="fa-solid fa-hourglass-end text-lg"></i></button>
            </div>
          </>
        )}
      </div>
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

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const initMatch = async (diff: string) => {
    if (!user) return;
    setDifficulty(diff);
    if (mode === 'multi') {
      const code = generateRoomCode();
      await setDoc(doc(db, 'matches', code), { hostId: user.uid, status: 'waiting', difficulty: diff, mode: 'multi', players: [{ uid: user.uid, name: user.email?.split('@')[0], classType: null, isReady: false, role: 'host' }], chat: [], log: ["Invocación lista."], createdAt: Date.now() });
      setMatchId(code);
      setView('lobby_waiting');
    } else {
      setView('hero_selection');
    }
  };

  const finalizeSolo = async (classType: string) => {
    if (!user) return;
    const code = generateRoomCode();
    await setDoc(doc(db, 'matches', code), { 
      hostId: user.uid, status: 'combat', difficulty, mode, 
      players: [{ uid: user.uid, name: user.email?.split('@')[0], classType, isReady: true, role: 'host', hp: CLASSES[classType].hp, pa: 5, cooldowns: {} }], 
      turnOrder: [user.uid], activeTurnUid: user.uid, phase: 'players', playersReadyForNext: [], log: ["Aventura solitaria iniciada."], createdAt: Date.now() 
    });
    setMatchId(code);
    setView('game');
  };

  const joinMatch = async () => {
    const code = joinCode.toUpperCase().trim();
    const snap = await getDoc(doc(db, 'matches', code));
    if (snap.exists() && snap.data().players.length < 3) {
      await updateDoc(doc(db, 'matches', code), { players: arrayUnion({ uid: user?.uid, name: user?.email?.split('@')[0], classType: null, isReady: false, role: 'guest' }) });
      setMatchId(code);
      setView('lobby_waiting');
    } else { alert("Sala no válida o llena"); }
  };

  if (loading) return <div className="h-screen bg-white flex flex-col items-center justify-center fantasy-font text-2xl uppercase tracking-widest animate-pulse">Cargando Reinos...</div>;
  if (!user) return <AuthScreen />;
  if (view === 'lobby_waiting' && matchId) return <LobbyWaiting matchId={matchId} user={user} onStart={() => setView('game')} onLeave={() => { setMatchId(null); setView('lobby'); }} />;
  if (view === 'game' && matchId) return <GameBoard matchId={matchId} user={user} onLeave={() => { setMatchId(null); setView('lobby'); }} />;

  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center animate-fade-in">
      {view === 'lobby' && (
        <>
          <h1 className="text-6xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-16">Estratega de Mazmorras</p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => { setMode('campaign'); setView('campaign'); }} className="w-full bg-slate-900 text-white py-5 rounded-[32px] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Campaña</button>
            <button onClick={() => { setMode('individual'); setView('individual'); }} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[32px] font-black uppercase text-[10px] shadow-sm active:scale-95 transition-all">Individual</button>
            <button onClick={() => { setMode('multi'); setView('multi_menu'); }} className="w-full bg-slate-50 border border-slate-100 py-5 rounded-[32px] font-black uppercase text-[10px] shadow-sm active:scale-95 transition-all">Multijugador</button>
            <button onClick={() => signOut(auth)} className="mt-8 text-slate-300 font-black uppercase text-[8px] tracking-[0.3em]">Desconectar</button>
          </div>
        </>
      )}

      {view === 'campaign' && (
        <SubMenuLayout title="Campaña" subtitle="Capítulo I: El Despertar" onBack={() => setView('lobby')}>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-4">
             <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase">Las sombras se extienden sobre el reino de Shuffle. Elige tu dificultad y comienza la travesía.</p>
          </div>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] shadow-xl active:scale-95">Continuar Acto</button>
        </SubMenuLayout>
      )}

      {view === 'individual' && (
        <SubMenuLayout title="Individual" subtitle="Reto del Ermitaño" onBack={() => setView('lobby')}>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] shadow-xl active:scale-95">Ir a la Mazmorra</button>
        </SubMenuLayout>
      )}

      {view === 'multi_menu' && (
        <SubMenuLayout title="Multijugador" subtitle="Gremio de Exploradores" onBack={() => setView('lobby')}>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] shadow-xl mb-4">Crear Sesión</button>
          <div className="pt-6 border-t border-slate-100">
             <input type="text" placeholder="ID DE SALA" className="w-full bg-slate-50 border border-slate-100 p-5 rounded-3xl text-[12px] font-black text-center mb-4 outline-none focus:border-amber-400 uppercase tracking-widest" value={joinCode} onChange={e => setJoinCode(e.target.value.slice(0,5))} />
             <button onClick={joinMatch} disabled={joinCode.length < 5} className="w-full bg-slate-50 text-slate-900 py-4 rounded-3xl font-black uppercase text-[9px] shadow-sm">Unirse al Grupo</button>
          </div>
        </SubMenuLayout>
      )}

      {view === 'difficulty' && (
        <SubMenuLayout title="Dificultad" subtitle="Balance de Poder" onBack={() => setView('lobby')}>
          {['Fácil', 'Normal', 'Difícil', 'Infinito'].map(d => (
            <button key={d} onClick={() => initMatch(d)} className="w-full bg-slate-50 border border-slate-100 p-5 rounded-3xl text-[10px] font-black hover:border-amber-400 transition-all uppercase tracking-widest shadow-sm">{d}</button>
          ))}
        </SubMenuLayout>
      )}

      {view === 'hero_selection' && (
        <SubMenuLayout title="Héroe" subtitle="Elige tu Avatar" onBack={() => setView('difficulty')}>
          {Object.keys(CLASSES).map(key => (
            <button key={key} onClick={() => finalizeSolo(key)} className="w-full flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[28px] hover:border-amber-400 group active:scale-95 transition-all shadow-sm">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg"><i className={`fa-solid ${CLASSES[key].icon}`}></i></div>
              <div className="text-left flex-grow">
                <h3 className="fantasy-font text-sm text-slate-900 uppercase">{key}</h3>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Vida: {CLASSES[key].hp} • Daño: {CLASSES[key].baseAtk}</p>
              </div>
            </button>
          ))}
        </SubMenuLayout>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);