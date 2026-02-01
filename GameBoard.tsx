
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { RaidSession, Hero, Card, Enemy } from './types';
import { generateEnemy, generateEncounterText } from './geminiService';

interface Props {
  raidId: string;
  hero: Hero;
  onLeave: () => void;
}

const REWARD_POOL: Card[] = [
  { id: 'extra1', name: 'Holy Nova', type: 'Heal', value: 20, cost: 3, description: 'Blinding light heals all.', icon: 'fa-sun' },
  { id: 'extra2', name: 'Dragon Breath', type: 'Attack', value: 25, cost: 4, description: 'Incinerate your foes.', icon: 'fa-dragon' },
  { id: 'extra3', name: 'Shadow Cloak', type: 'Defend', value: 15, cost: 2, description: 'Become untraceable.', icon: 'fa-mask' },
  { id: 'extra4', name: 'Execution', type: 'Attack', value: 30, cost: 5, description: 'A final, lethal strike.', icon: 'fa-skull' },
];

const GameBoard: React.FC<Props> = ({ raidId, hero, onLeave }) => {
  const [session, setSession] = useState<RaidSession | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [energy, setEnergy] = useState(0);
  const [narrative, setNarrative] = useState("The dungeon is silent...");
  const [localHp, setLocalHp] = useState(hero.hp);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'raids', raidId), (snapshot) => {
      if (!snapshot.exists()) {
        onLeave();
        return;
      }
      const data = snapshot.data() as RaidSession;
      setSession({ id: snapshot.id, ...data });
    });
    return unsubscribe;
  }, [raidId, onLeave]);

  const startCombat = async () => {
    const enemy = await generateEnemy(hero.level);
    await updateDoc(doc(db, 'raids', raidId), {
      status: 'combat',
      currentEnemy: enemy,
      log: [...(session?.log || []), `A wild ${enemy.name} appeared!`]
    });
    setHand(hero.deck.sort(() => Math.random() - 0.5).slice(0, 4));
    setEnergy(hero.maxMana);
  };

  const playCard = async (card: Card) => {
    if (!session || !session.currentEnemy || energy < card.cost) return;

    let updatedEnemy = { ...session.currentEnemy };
    let logMsg = "";

    if (card.type === 'Attack') {
      updatedEnemy.hp -= card.value;
      logMsg = `${hero.name} deals ${card.value} damage with ${card.name}!`;
    } else if (card.type === 'Heal') {
      setLocalHp(prev => Math.min(hero.maxHp, prev + card.value));
      logMsg = `${hero.name} uses ${card.name} and feels revitalized!`;
    }

    setEnergy(prev => prev - card.cost);
    setHand(prev => prev.filter(c => c.id !== card.id));

    const text = await generateEncounterText(updatedEnemy.name, "reeling from a player attack");
    setNarrative(text);

    if (updatedEnemy.hp <= 0) {
      await updateDoc(doc(db, 'raids', raidId), {
        status: 'reward',
        currentEnemy: null,
        log: [...session.log, logMsg, `${updatedEnemy.name} has been defeated! Loot appears!`]
      });
    } else {
      await updateDoc(doc(db, 'raids', raidId), {
        currentEnemy: updatedEnemy,
        log: [...session.log, logMsg]
      });
    }
  };

  const claimReward = async (card: Card) => {
    // Add card to user's permanent deck in Firestore
    const userRef = doc(db, 'users', hero.uid);
    await updateDoc(userRef, {
      deck: arrayUnion(card)
    });
    
    // Continue the raid
    await updateDoc(doc(db, 'raids', raidId), {
      status: 'lobby',
      log: [...(session?.log || []), `${hero.name} claimed ${card.name}!`]
    });
  };

  const endTurn = async () => {
    if (!session || !session.currentEnemy) return;
    
    const dmg = session.currentEnemy.damage;
    setLocalHp(prev => Math.max(0, prev - dmg));
    const logMsg = `The ${session.currentEnemy.name} strikes back for ${dmg} damage!`;
    
    setEnergy(hero.maxMana);
    setHand(hero.deck.sort(() => Math.random() - 0.5).slice(0, 4));

    await updateDoc(doc(db, 'raids', raidId), {
      turnNumber: session.turnNumber + 1,
      log: [...session.log, logMsg]
    });

    if (localHp - dmg <= 0) {
      await updateDoc(doc(db, 'raids', raidId), { status: 'defeat' });
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-4">
      {/* HUD */}
      <div className="flex justify-between items-center mb-6 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Champion</span>
            <div className="flex items-center gap-4">
              <span className="text-amber-500 fantasy-font text-lg">{hero.name}</span>
              <div className="h-4 w-48 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-500" 
                  style={{ width: `${(localHp / hero.maxHp) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-red-400">{localHp}/{hero.maxHp} HP</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Essence</span>
            <div className="flex gap-1 mt-1">
              {[...Array(hero.maxMana)].map((_, i) => (
                <div key={i} className={`h-6 w-6 rounded-full border-2 transition-all ${i < energy ? 'bg-blue-500 border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-slate-800 border-slate-700 opacity-30'}`}></div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onLeave} className="px-4 py-2 rounded bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-white transition-all text-sm uppercase tracking-widest fantasy-font border border-slate-700">
          <i className="fa-solid fa-door-open mr-2"></i> Retreat
        </button>
      </div>

      <div className="flex-grow flex gap-4 overflow-hidden mb-4">
        {/* Arena Principal */}
        <div className="flex-grow bg-slate-900/50 rounded-2xl relative flex flex-col items-center justify-center p-8 border border-slate-800/50 backdrop-blur-sm">
          <div className="absolute top-6 left-6 right-6 bg-slate-950/90 p-4 rounded-lg italic text-amber-200/90 text-center border-l-4 border-amber-600 shadow-2xl">
            "{narrative}"
          </div>

          {session.status === 'lobby' && (
            <div className="text-center">
              <div className="w-24 h-24 bg-amber-600/10 rounded-full flex items-center justify-center mb-6 mx-auto border-2 border-amber-600/30 animate-pulse">
                <i className="fa-solid fa-skull-crossbones text-4xl text-amber-500"></i>
              </div>
              <h2 className="text-4xl fantasy-font text-white mb-4 tracking-tighter">Enter the Depths</h2>
              <p className="text-slate-400 mb-8 max-w-sm">Shadows stir in the dark. Will you face the unknown?</p>
              <button 
                onClick={startCombat}
                className="bg-amber-600 hover:bg-amber-500 px-12 py-4 rounded-xl text-xl fantasy-font tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95"
              >
                DESCENT
              </button>
            </div>
          )}

          {session.status === 'combat' && session.currentEnemy && (
            <div className="flex flex-col items-center gap-8 animate-fadeIn">
              <div className="relative group">
                <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full animate-pulse group-hover:bg-red-600/40 transition-all"></div>
                <img 
                  src={`https://picsum.photos/seed/${session.currentEnemy.name}/400/400`} 
                  className="w-72 h-72 rounded-3xl border-4 border-slate-800 relative z-10 shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                  alt="Enemy" 
                />
                <div className="absolute -bottom-6 -left-8 -right-8 bg-slate-950 p-4 rounded-xl border border-amber-900/50 z-20 text-center shadow-2xl">
                  <h3 className="text-2xl fantasy-font text-red-500 tracking-wider mb-1 uppercase">{session.currentEnemy.name}</h3>
                  <div className="h-4 w-full bg-slate-900 rounded-full mt-2 border border-slate-800 overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-700 rounded-full" 
                      style={{ width: `${(session.currentEnemy.hp / session.currentEnemy.maxHp) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Health: {session.currentEnemy.hp}</span>
                    <span className="text-[10px] text-amber-500 uppercase font-bold">Intent: {session.currentEnemy.intent}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {session.status === 'reward' && (
            <div className="text-center animate-fadeIn">
              <h2 className="text-5xl fantasy-font text-amber-500 mb-8 drop-shadow-lg">LOOT ACQUIRED</h2>
              <p className="text-slate-300 mb-8">The monster falls. Choose one relic to strengthen your deck:</p>
              <div className="flex gap-6 justify-center">
                {REWARD_POOL.sort(() => Math.random() - 0.5).slice(0, 3).map((card) => (
                  <div 
                    key={card.id}
                    onClick={() => claimReward(card)}
                    className="w-44 h-64 bg-gradient-to-b from-amber-900/40 to-slate-900 border-2 border-amber-600/50 rounded-2xl p-4 cursor-pointer hover:scale-110 hover:border-amber-400 transition-all flex flex-col shadow-2xl"
                  >
                    <div className="text-3xl text-amber-500 mb-2 text-center"><i className={`fa-solid ${card.icon}`}></i></div>
                    <h4 className="text-sm fantasy-font text-white mb-2 border-b border-amber-600/20 pb-1">{card.name}</h4>
                    <p className="text-[10px] text-slate-400 flex-grow italic">{card.description}</p>
                    <div className="bg-amber-600/20 text-amber-400 text-[10px] font-bold py-1 rounded text-center">CLAIM CARD</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.status === 'defeat' && (
            <div className="text-center">
              <h2 className="text-6xl fantasy-font text-red-700 mb-4 tracking-tighter">OVERTHROWN</h2>
              <p className="text-slate-400 mb-8">Your journey ends in the darkness. Rise again, hero.</p>
              <button onClick={onLeave} className="bg-slate-800 px-10 py-4 rounded-xl fantasy-font text-white hover:bg-slate-700 transition-all border border-slate-600">RETURN TO HALL</button>
            </div>
          )}
        </div>

        {/* Log Lateral */}
        <div className="w-80 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col backdrop-blur-sm">
          <h3 className="text-[10px] uppercase text-slate-500 tracking-[0.2em] mb-4 font-black border-b border-slate-800 pb-2">Ancient Chronicle</h3>
          <div className="flex-grow overflow-y-auto text-xs space-y-3 pr-2 scroll-smooth">
            {session.log.slice().reverse().map((msg, i) => (
              <div key={i} className={`p-3 rounded-lg bg-slate-950/60 border-l-2 ${msg.includes('deals') ? 'border-red-500 text-red-100' : 'border-slate-700 text-slate-300'} animate-fadeIn`}>
                <span className="opacity-50 text-[9px] mr-2">[{session.log.length - i}]</span> {msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hand area */}
      <div className="h-64 flex gap-4">
        <div className="flex-grow flex justify-center items-center gap-4 bg-slate-900/20 rounded-2xl p-6 border border-slate-900/50 relative">
          <div className="absolute -top-3 left-6 px-3 bg-slate-950 text-[10px] text-slate-500 uppercase font-black tracking-widest border border-slate-800 rounded">Current Hand</div>
          {hand.map((card, idx) => (
            <div 
              key={card.id + idx}
              onClick={() => playCard(card)}
              className={`w-40 h-56 bg-gradient-to-br from-slate-800 to-slate-950 border-2 rounded-2xl p-4 flex flex-col card-glow cursor-pointer relative shadow-2xl transform hover:-rotate-1 ${energy < card.cost ? 'opacity-40 grayscale cursor-not-allowed border-slate-800' : 'border-slate-700 hover:border-amber-500'}`}
            >
              <div className="absolute -top-3 -left-3 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white shadow-2xl border-2 border-slate-900 z-10">
                {card.cost}
              </div>
              <div className="text-3xl text-amber-500 text-center mb-3 mt-2">
                <i className={`fa-solid ${card.icon}`}></i>
              </div>
              <h4 className="text-[11px] fantasy-font text-white text-center border-b border-slate-800 pb-2 mb-2 tracking-wide truncate">{card.name}</h4>
              <p className="text-[10px] text-slate-500 text-center mb-2 italic leading-tight">"{card.description}"</p>
              <div className="flex-grow"></div>
              <div className={`text-[10px] text-center font-bold py-1.5 rounded-lg ${card.type === 'Attack' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'} border border-white/5`}>
                {card.type} {card.value > 0 ? `(${card.value})` : ''}
              </div>
            </div>
          ))}
          {hand.length === 0 && session.status === 'combat' && (
             <div className="text-slate-700 fantasy-font text-xl opacity-20 uppercase tracking-[0.5em]">No Cards Remaining</div>
          )}
        </div>
        
        <div className="w-56 flex flex-col gap-3">
          <button 
            disabled={session.status !== 'combat'}
            onClick={endTurn}
            className="flex-grow bg-amber-900/20 hover:bg-amber-600 group disabled:opacity-30 disabled:hover:bg-amber-900/20 rounded-2xl fantasy-font tracking-[0.2em] text-amber-500 flex flex-col items-center justify-center transition-all border-2 border-amber-900/30 hover:border-amber-500 shadow-lg"
          >
            <i className="fa-solid fa-hourglass-end text-2xl mb-2 group-hover:rotate-12 transition-transform"></i>
            END TURN
          </button>
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-3 text-center flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 block uppercase font-black tracking-tighter mb-1">Arsenal Capacity</span>
            <span className="text-2xl text-white fantasy-font leading-none">{hero.deck.length}</span>
            <span className="text-[8px] text-slate-600 uppercase mt-1">Total Cards</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
