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
  updateDoc, 
  arrayUnion,
  getDoc,
  setDoc,
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
      { id: 'strike', name: 'Golpe Letal', type: 'Attack', cost: 2, cooldown: 0, power: 7, icon: 'fa-sword' },
      { id: 'rally', name: 'Grito de Guerra', type: 'Support', cost: 3, cooldown: 2, power: 6, desc: 'Cura HP a un aliado', icon: 'fa-bullhorn' },
      { id: 'protect', name: 'Escudo Mural', type: 'Support', cost: 2, cooldown: 2, power: 4, desc: 'Otorga PA a un aliado', icon: 'fa-shield' }
    ]
  },
  Mage: { 
    hp: 15, def: 1, baseAtk: 6, icon: 'fa-wand-sparkles', color: 'blue',
    abilities: [
      { id: 'fireball', name: 'Bola de Fuego', type: 'Attack', cost: 3, cooldown: 0, power: 11, icon: 'fa-fire' },
      { id: 'arcane_shield', name: 'Velo Arcano', type: 'Support', cost: 2, cooldown: 2, power: 5, desc: 'Recarga energía arcana', icon: 'fa-hand-sparkles' },
      { id: 'blink', name: 'Traslación', type: 'Support', cost: 1, cooldown: 1, power: 0, desc: 'Esquiva próximo ataque', icon: 'fa-bolt-lightning' }
    ]
  },
  Hunter: { 
    hp: 20, def: 2, baseAtk: 5, icon: 'fa-crosshairs', color: 'emerald',
    abilities: [
      { id: 'shot', name: 'Flecha Certera', type: 'Attack', cost: 2, cooldown: 0, power: 8, icon: 'fa-location-arrow' },
      { id: 'herbs', name: 'Hierbas Curativas', type: 'Support', cost: 2, cooldown: 1, power: 5, desc: 'Cura HP moderado', icon: 'fa-leaf' },
      { id: 'trap', name: 'Trampa de Osos', type: 'Attack', cost: 3, cooldown: 3, power: 6, desc: 'Aturde al enemigo', icon: 'fa-link' }
    ]
  }
};

const ENEMIES = [
  { name: "Horda de Goblins", hp: 12, maxHp: 12, damage: 4, def: 1, icon: 'fa-users-viewfinder', skillDesc: "Ataque rápido y coordinado." },
  { name: "Ogro del Pantano", hp: 26, maxHp: 26, damage: 9, def: 2, icon: 'fa-hand-fist', skillDesc: "Golpe aplastante que ignora parte de la defensa." },
  { name: "Gólem Arcano", hp: 38, maxHp: 38, damage: 7, def: 5, icon: 'fa-mountain', skillDesc: "Piel de piedra impenetrable." },
  { name: "Lamía Seductora", hp: 30, maxHp: 30, damage: 6, def: 2, icon: 'fa-staff-snake', skillDesc: "Drenaje de esencia vital." }
];

const DIFFICULTY_CONFIG: Record<string, number> = {
  'Fácil': 10,
  'Normal': 15,
  'Difícil': 25,
  'Infinito': 999
};

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
              <div className={`w-12 h-12 ${p.classType ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-200 text-slate-400'} rounded-2xl flex items-center justify-center text-xl`}>
                <i className={`fa-solid ${p.classType ? CLASSES[p.classType].icon : 'fa-user-clock'}`}></i>
              </div>
              <div className="flex-grow">
                <p className="text-[10px] font-black uppercase text-slate-900">{p.name} {p.role === 'host' && '👑'}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p.classType || 'Eligiendo...'}</p>
              </div>
              {p.role !== 'host' && <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${p.isReady ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}><i className="fa-solid fa-check text-[10px]"></i></div>}
            </div>
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
            <button onClick={sendMessage} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fa-solid fa-bolt text-[10px]"></i></button>
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
  const [targeting, setTargeting] = useState<any>(null);
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

  const findLowestHpPlayer = (players: any[]) => {
    return players.reduce((prev, curr) => (prev.hp < curr.hp ? prev : curr));
  };

  const findMaxDamagePlayer = (players: any[], damageDealtBy: Record<string, number>) => {
    let maxDmg = -1;
    let targetUid = players[0]?.uid || "";
    players.forEach(p => {
      const dmg = damageDealtBy[p.uid] || 0;
      if (dmg > maxDmg) {
        maxDmg = dmg;
        targetUid = p.uid;
      }
    });
    return players.find(p => p.uid === targetUid) || players[0];
  };

  const useAbility = async (ability: any, targetUid?: string) => {
    if (!isMyTurn || myP.pa < ability.cost) return;

    let updatedPlayers = [...match.players];
    let updatedEnemy = match.enemy ? { ...match.enemy } : null;
    let logMsg = "";

    if (ability.type === 'Attack' && updatedEnemy) {
      const damage = Math.max(1, ability.power - updatedEnemy.def);
      updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
      updatedEnemy.damageDealtBy = updatedEnemy.damageDealtBy || {};
      updatedEnemy.damageDealtBy[user.uid] = (updatedEnemy.damageDealtBy[user.uid] || 0) + damage;
      logMsg = `${myP.name} usa ${ability.name} causando ${damage} daño.`;
    } else if (ability.type === 'Support' && targetUid) {
      const targetIdx = updatedPlayers.findIndex(p => p.uid === targetUid);
      if (ability.id === 'rally' || ability.id === 'herbs') {
        updatedPlayers[targetIdx].hp = Math.min(CLASSES[updatedPlayers[targetIdx].classType].hp, updatedPlayers[targetIdx].hp + ability.power);
        logMsg = `${myP.name} sana a ${updatedPlayers[targetIdx].name}.`;
      } else {
        updatedPlayers[targetIdx].pa = Math.min(5, updatedPlayers[targetIdx].pa + 2);
        logMsg = `${myP.name} potencia a ${updatedPlayers[targetIdx].name}.`;
      }
    }

    const meIdx = updatedPlayers.findIndex(p => p.uid === user.uid);
    updatedPlayers[meIdx].pa -= ability.cost;
    updatedPlayers[meIdx].cooldowns[ability.id] = ability.cooldown;

    const updates: any = { players: updatedPlayers, log: arrayUnion(logMsg) };
    if (updatedEnemy) {
      updates.enemy = updatedEnemy;
      if (updatedEnemy.hp === 0) {
        updates.enemy = null;
        updates.log = arrayUnion(`¡${updatedEnemy.name} derrotado!`);
        updates.deckRemaining = increment(-1);
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
      if (isHost && match.enemy) {
        setTimeout(async () => {
          const roll = Math.random();
          let targetP;
          // 16.67% al que tiene menos vida, 83.33% al que hizo más daño
          if (roll < 0.1667) {
            targetP = findLowestHpPlayer(match.players);
          } else {
            targetP = findMaxDamagePlayer(match.players, match.enemy.damageDealtBy || {});
          }
          
          const enemyDmg = Math.max(1, match.enemy.damage - (targetP?.def || 0));
          const newPlayers = match.players.map((p: any) => ({
            ...p,
            hp: p.uid === targetP?.uid ? Math.max(0, p.hp - enemyDmg) : p.hp,
            pa: Math.min(5, p.pa + 2) // Recarga de 2 PA por turno completo
          }));
          
          await updateDoc(doc(db, 'matches', matchId), {
            players: newPlayers,
            phase: 'players',
            activeTurnUid: match.turnOrder[0],
            log: arrayUnion(`${match.enemy.name} ataca a ${targetP?.name} causando ${enemyDmg} daño.`)
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

    if (newList.length === match.players.length && isHost && !match.enemy && match.deckRemaining > 0) {
      const nextEnemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
      const startRoll = Math.random();
      let logEntry = `Aparece ${nextEnemy.name}.`;
      let finalPlayers = [...match.players];
      let finalPhase = 'players';
      let finalActiveUid = match.turnOrder[0];

      // 16.67% de probabilidad de que el enemigo empiece atacando (Emboscada)
      if (startRoll < 0.1667) {
        const targetP = findLowestHpPlayer(match.players);
        const dmg = Math.max(1, nextEnemy.damage - (targetP?.def || 0));
        finalPlayers = finalPlayers.map(p => p.uid === targetP?.uid ? { ...p, hp: Math.max(0, p.hp - dmg) } : p);
        logEntry = `¡EMBOSCADA! ${nextEnemy.name} ataca a ${targetP?.name} por ${dmg} daño antes de que podáis reaccionar.`;
      }

      await updateDoc(doc(db, 'matches', matchId), { 
        enemy: { ...nextEnemy, hp: nextEnemy.hp, maxHp: nextEnemy.maxHp, damageDealtBy: {} },
        players: finalPlayers,
        log: arrayUnion(logEntry),
        phase: finalPhase,
        activeTurnUid: finalActiveUid
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
      log: ["Regresando a la base..."],
      playersReadyForNext: []
    });
  };

  const allDead = match.players.every((p: any) => p.hp <= 0);
  const victory = match.deckRemaining <= 0;

  if (allDead || victory) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
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
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* HUD de Aliados (Tarjetas de Héroe) */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-100 shadow-sm z-10">
        {match.players.map((p: any) => (
          <div 
            key={p.uid} 
            onClick={() => targeting?.ability.type === 'Support' && p.hp > 0 && useAbility(targeting.ability, p.uid)}
            className={`p-3 rounded-3xl border transition-all ${p.uid === match.activeTurnUid ? 'border-amber-400 bg-white shadow-md scale-105 ring-2 ring-amber-100' : 'border-slate-100 bg-slate-50 opacity-80'} ${targeting?.ability.type === 'Support' && p.hp > 0 ? 'cursor-pointer ring-4 ring-emerald-400/30' : ''}`}
          >
            <div className="flex justify-between items-center mb-1">
              <i className={`fa-solid ${CLASSES[p.classType].icon} text-[12px] ${p.hp > 0 ? 'text-slate-900' : 'text-red-400'}`}></i>
              <span className="text-[8px] font-black uppercase text-slate-500">{p.name.slice(0,8)}</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner mb-1">
              <div className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-500" style={{ width: `${(p.hp / CLASSES[p.classType].hp) * 100}%` }}></div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[7px] font-black text-slate-400">{p.hp} HP</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < p.pa ? 'bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-slate-200'}`}></div>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Encuentro Principal y Contador de Mazo */}
      <div className="flex-grow flex flex-col p-4 gap-4 overflow-hidden relative">
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-1 pointer-events-none">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Restantes</span>
           <span className="text-xl fantasy-font text-slate-900">{match.deckRemaining}/{DIFFICULTY_CONFIG[match.difficulty]}</span>
        </div>

        <div className="flex-grow bg-slate-50 rounded-[48px] border border-slate-100 flex flex-col items-center justify-center p-8 shadow-inner relative overflow-hidden">
          {match.enemy ? (
            <div className="text-center animate-fade-in w-full">
              <div className="relative inline-block mb-6">
                <i className={`fa-solid ${match.enemy.icon} text-8xl text-slate-900 drop-shadow-2xl`}></i>
                {match.phase === 'enemy' && <div className="absolute inset-0 bg-red-500/10 animate-ping rounded-full scale-150"></div>}
              </div>
              <h3 className="fantasy-font text-2xl uppercase mb-1 tracking-tighter text-slate-800">{match.enemy.name}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 italic px-8">"{match.enemy.skillDesc}"</p>
              
              <div className="w-56 h-2 bg-slate-200 rounded-full overflow-hidden mx-auto shadow-inner border border-white mb-2">
                <div className="h-full bg-slate-900 transition-all duration-700" style={{ width: `${(match.enemy.hp / match.enemy.maxHp) * 100}%` }}></div>
              </div>
              
              <div className="flex gap-4 justify-center items-center mt-2">
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black text-slate-400 uppercase">Ataque</span>
                   <span className="text-[12px] font-black text-red-500">{match.enemy.damage}</span>
                 </div>
                 <div className="h-6 w-[1px] bg-slate-200"></div>
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black text-slate-400 uppercase">Defensa</span>
                   <span className="text-[12px] font-black text-slate-900">{match.enemy.def}</span>
                 </div>
                 <div className="h-6 w-[1px] bg-slate-200"></div>
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black text-slate-400 uppercase">Vida</span>
                   <span className="text-[12px] font-black text-slate-900">{match.enemy.hp}</span>
                 </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-6 text-slate-200 text-7xl"><i className="fa-solid fa-clone"></i></div>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Mazo de Incursión</p>
              
              <div className="mt-4 flex gap-2 justify-center mb-8">
                {match.players.map((p: any) => (
                  <div key={p.uid} className={`w-3 h-3 rounded-full shadow-sm transition-all duration-300 ${match.playersReadyForNext?.includes(p.uid) ? 'bg-emerald-500 scale-125' : 'bg-slate-200'}`}></div>
                ))}
              </div>
            </div>
          )}

          {/* Botón "Listo para avanzar" siempre visible */}
          <div className="absolute bottom-8 w-full flex justify-center">
              <label className="group flex items-center gap-4 bg-white px-8 py-5 rounded-[32px] border border-slate-200 cursor-pointer shadow-lg hover:border-amber-400 hover:shadow-amber-100 transition-all active:scale-95">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${myReadyToAdvance ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200'}`}>
                   {myReadyToAdvance && <i className="fa-solid fa-check text-xs"></i>}
                </div>
                <input type="checkbox" className="hidden" checked={!!myReadyToAdvance} onChange={toggleReadyToAdvance} />
                <span className="text-[11px] font-black uppercase text-slate-900 tracking-widest">Listo para avanzar</span>
              </label>
          </div>
        </div>

        {/* Panel de Registro y Chat */}
        <div className="h-32 flex gap-3">
          <div className="flex-grow bg-white rounded-[32px] border border-slate-100 p-4 overflow-y-auto no-scrollbar shadow-sm">
            {match.log?.slice(-8).map((l: string, i: number) => (
              <p key={i} className="text-[9px] font-bold text-slate-400 mb-1 border-l-2 border-amber-400 pl-3 italic leading-tight">{l}</p>
            ))}
            <div ref={logEndRef}></div>
          </div>
          <div className="w-28 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col p-3 shadow-inner">
             <div className="flex-grow overflow-y-auto no-scrollbar text-[8px] font-bold text-slate-500 space-y-2">
                {match.chat?.slice(-5).map((c: any, i: number) => (
                  <div key={i} className="leading-tight"><span className="text-slate-900 block text-[7px] uppercase truncate">{c.user}:</span> {c.text}</div>
                ))}
             </div>
             <input type="text" className="mt-2 w-full bg-white text-[8px] p-2 rounded-xl border border-slate-100 shadow-sm outline-none focus:border-amber-400" placeholder="..." onKeyDown={e => { if(e.key==='Enter') { sendMessage(); (e.target as any).value = ''; } }} onChange={e => setMsg(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Barra de Habilidades y Turno */}
      <div className={`p-5 ${myP.hp <= 0 ? 'bg-slate-100' : 'bg-slate-900'} rounded-t-[48px] shadow-[0_-10px_40px_rgba(15,23,42,0.3)] transition-all duration-500`}>
        {myP.hp <= 0 ? (
           <div className="h-28 flex flex-col items-center justify-center gap-2">
              <i className="fa-solid fa-ghost text-2xl text-slate-300 animate-bounce"></i>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Derrotado en Combate</span>
           </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-5 px-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Puntos: {myP.pa}</span>
                <div className="flex gap-1.5">{[...Array(5)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-md rotate-45 transition-all duration-300 ${i < myP.pa ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]' : 'bg-slate-700'}`}></div>)}</div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isMyTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {isMyTurn ? 'TU TURNO' : 'ESPERANDO...'}
              </span>
            </div>
            <div className="flex gap-3 h-24">
              {CLASSES[myP.classType].abilities.map((ability: any) => (
                <button 
                  key={ability.id} 
                  disabled={!isMyTurn || myP.pa < ability.cost || (!match.enemy && ability.type === 'Attack')}
                  onClick={() => ability.type === 'Support' ? setTargeting({ ability }) : useAbility(ability)}
                  className={`flex-grow rounded-[28px] flex flex-col items-center justify-center p-2 relative border border-white/5 transition-all ${targeting?.ability.id === ability.id ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] -translate-y-2' : (isMyTurn && myP.pa >= ability.cost ? 'bg-slate-800' : 'bg-slate-800/40 opacity-40')}`}
                >
                  <i className={`fa-solid ${ability.icon} text-xl mb-1 text-amber-500`}></i>
                  <span className="text-[8px] font-black text-white uppercase tracking-tighter truncate w-full text-center px-1">{ability.name}</span>
                  <span className="text-[7px] font-bold text-slate-400 mt-0.5">{ability.cost} PA</span>
                </button>
              ))}
              <button onClick={endTurn} disabled={!isMyTurn} className="w-16 bg-white rounded-[28px] flex flex-col items-center justify-center text-slate-900 shadow-xl disabled:opacity-30 active:scale-90 transition-all"><i className="fa-solid fa-forward text-xl"></i></button>
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
      await setDoc(doc(db, 'matches', code), { 
        hostId: user.uid, status: 'waiting', difficulty: diff, mode: 'multi', 
        players: [{ uid: user.uid, name: user.email?.split('@')[0], classType: null, isReady: false, role: 'host' }], 
        chat: [], log: ["Invocación lista."], createdAt: Date.now(),
        deckRemaining: DIFFICULTY_CONFIG[diff]
      });
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
      turnOrder: [user.uid], activeTurnUid: user.uid, phase: 'players', playersReadyForNext: [], log: ["Senda solitaria iniciada."], createdAt: Date.now(),
      deckRemaining: DIFFICULTY_CONFIG[difficulty]
    });
    setMatchId(code);
    setView('game');
  };

  const joinMatch = async () => {
    const code = joinCode.toUpperCase().trim();
    const snap = await getDoc(doc(db, 'matches', code));
    if (snap.exists() && snap.data().players.length < 3) {
      const p = { uid: user?.uid, name: user?.email?.split('@')[0], classType: null, isReady: false, role: 'guest' };
      const currentPlayers = snap.data().players;
      if (!currentPlayers.find((existing: any) => existing.uid === user?.uid)) {
        await updateDoc(doc(db, 'matches', code), { players: [...currentPlayers, p] });
      }
      setMatchId(code);
      setView('lobby_waiting');
    } else { alert("Sala no válida o llena"); }
  };

  if (loading) return <div className="h-screen bg-white flex flex-col items-center justify-center fantasy-font text-2xl uppercase tracking-[0.2em] animate-pulse text-slate-900">Invocando Reinos...</div>;
  if (!user) return <AuthScreen />;
  if (view === 'lobby_waiting' && matchId) return <LobbyWaiting matchId={matchId} user={user} onStart={() => setView('game')} onLeave={() => { setMatchId(null); setView('lobby'); }} />;
  if (view === 'game' && matchId) return <GameBoard matchId={matchId} user={user} onLeave={() => { setMatchId(null); setView('lobby'); }} />;

  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center animate-fade-in">
      {view === 'lobby' && (
        <>
          <h1 className="text-6xl fantasy-font text-slate-900 mb-2 uppercase tracking-tighter">SHUFFLE RAID</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.6em] mb-20">Estrategia y Mazo v3.0</p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => { setMode('campaign'); setView('campaign'); }} className="w-full bg-slate-900 text-white py-6 rounded-[36px] font-black uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Campaña</button>
            <button onClick={() => { setMode('individual'); setView('individual'); }} className="w-full bg-slate-50 border border-slate-100 py-6 rounded-[36px] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all">Individual</button>
            <button onClick={() => { setMode('multi'); setView('multi_menu'); }} className="w-full bg-slate-50 border border-slate-100 py-6 rounded-[36px] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all">Multijugador</button>
            <button onClick={() => signOut(auth)} className="mt-12 text-slate-300 font-black uppercase text-[9px] tracking-[0.4em] hover:text-red-400 transition-colors">Desconectar</button>
          </div>
        </>
      )}

      {view === 'campaign' && (
        <SubMenuLayout title="Campaña" subtitle="El Despertar del Caos" onBack={() => setView('lobby')}>
          <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 mb-6">
             <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">Un antiguo mal despierta en Shuffle. Solo los más sabios estrategas podrán sellar la brecha del vacío.</p>
          </div>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Iniciar Aventura</button>
        </SubMenuLayout>
      )}

      {view === 'individual' && (
        <SubMenuLayout title="Individual" subtitle="Senda del Guerrero Solitario" onBack={() => setView('lobby')}>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Entrar al Calabozo</button>
        </SubMenuLayout>
      )}

      {view === 'multi_menu' && (
        <SubMenuLayout title="Multijugador" subtitle="Gremio de Incursores" onBack={() => setView('lobby')}>
          <button onClick={() => setView('difficulty')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl mb-4">Crear Grupo</button>
          <div className="pt-8 border-t border-slate-100 mt-4">
             <input type="text" placeholder="ID SALA" className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[32px] text-[13px] font-black text-center mb-4 outline-none focus:border-amber-400 uppercase tracking-[0.3em] fantasy-font" value={joinCode} onChange={e => setJoinCode(e.target.value.slice(0,5))} />
             <button onClick={joinMatch} disabled={joinCode.length < 5} className="w-full bg-slate-50 text-slate-900 py-5 rounded-[32px] font-black uppercase text-[10px] tracking-widest border border-slate-100 active:scale-95 transition-all">Unirse</button>
          </div>
        </SubMenuLayout>
      )}

      {view === 'difficulty' && (
        <SubMenuLayout title="Dificultad" subtitle="Balance de Riesgo" onBack={() => setView('lobby')}>
          {Object.keys(DIFFICULTY_CONFIG).map(d => (
            <button key={d} onClick={() => initMatch(d)} className="w-full bg-slate-50 border border-slate-100 p-5 rounded-3xl text-[10px] font-black hover:border-amber-400 hover:bg-white transition-all uppercase tracking-widest shadow-sm">{d}</button>
          ))}
        </SubMenuLayout>
      )}

      {view === 'hero_selection' && (
        <SubMenuLayout title="Héroe" subtitle="Elige tu Destino" onBack={() => setView('difficulty')}>
          {Object.keys(CLASSES).map(key => (
            <button key={key} onClick={() => finalizeSolo(key)} className="w-full flex items-center gap-5 p-6 bg-slate-50 border border-slate-100 rounded-[32px] hover:border-amber-400 hover:bg-white group active:scale-95 transition-all shadow-sm">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl group-hover:scale-110 transition-transform"><i className={`fa-solid ${CLASSES[key].icon}`}></i></div>
              <div className="text-left flex-grow">
                <h3 className="fantasy-font text-base text-slate-900 uppercase tracking-tighter">{key}</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HP: {CLASSES[key].hp} • ATK: {CLASSES[key].baseAtk} • DEF: {CLASSES[key].def}</p>
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