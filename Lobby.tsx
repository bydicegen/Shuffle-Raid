
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Hero, RaidSession } from './types';
import { User } from 'firebase/auth';

interface Props {
  user: User;
  hero: Hero;
  onJoinRaid: (id: string) => void;
}

const Lobby: React.FC<Props> = ({ user, hero, onJoinRaid }) => {
  const [raids, setRaids] = useState<RaidSession[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'raids'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeRaids = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RaidSession));
      setRaids(activeRaids.filter(r => r.status === 'lobby' || r.status === 'combat'));
    });
    return unsubscribe;
  }, []);

  const createRaid = async () => {
    const raidData = {
      hostId: user.uid,
      players: { [user.uid]: hero },
      status: 'lobby',
      turnOwnerId: user.uid,
      turnNumber: 1,
      log: [`${hero.name} has opened a portal to the Eldritch Void...`]
    };
    const docRef = await addDoc(collection(db, 'raids'), raidData);
    onJoinRaid(docRef.id);
  };

  const joinRaid = async (raidId: string) => {
    const raidRef = doc(db, 'raids', raidId);
    await updateDoc(raidRef, {
      [`players.${user.uid}`]: hero
    });
    onJoinRaid(raidId);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 bg-slate-800/50 p-8 rounded-3xl border border-slate-700 shadow-2xl backdrop-blur-sm">
          <div className="text-center md:text-left mb-6 md:mb-0">
            <h1 className="text-5xl fantasy-font text-amber-500 tracking-tighter">The Grand Hall</h1>
            <p className="text-slate-400 mt-2 font-medium">Welcome, <span className="text-amber-200">{hero.name}</span> the {hero.classType}</p>
          </div>
          <button 
            onClick={createRaid}
            className="bg-amber-600 hover:bg-amber-500 px-10 py-5 rounded-2xl fantasy-font tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:scale-105 active:scale-95"
          >
            FORM RAID PARTY
          </button>
        </header>

        <div className="space-y-6">
          <h2 className="text-3xl text-white mb-8 fantasy-font flex items-center gap-4">
            <i className="fa-solid fa-scroll text-amber-600"></i>
            Active Incursions
          </h2>
          {raids.length === 0 ? (
            <div className="bg-slate-800/30 p-20 text-center rounded-3xl border-2 border-dashed border-slate-700 text-slate-500 italic">
              <i className="fa-solid fa-ghost text-5xl mb-6 block opacity-20"></i>
              No active raid groups found. The void awaits its first challenger.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {raids.map(raid => (
                <div key={raid.id} className="bg-slate-800 border-2 border-slate-700 p-8 rounded-3xl flex flex-col hover:border-amber-500/50 transition-all group shadow-xl hover:shadow-amber-500/5">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl text-amber-400 fantasy-font mb-1 tracking-tight">Party #{raid.id.slice(0, 5)}</h3>
                      <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                        <i className="fa-solid fa-users"></i>
                        <span>{Object.keys(raid.players).length} / 4 Heroes</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${raid.status === 'combat' ? 'bg-red-950 text-red-400 border-red-800' : 'bg-green-950 text-green-400 border-green-800'}`}>
                      {raid.status}
                    </div>
                  </div>
                  
                  <div className="flex -space-x-3 mb-8">
                    {Object.values(raid.players).map((p, i) => (
                      <div key={i} title={p.name} className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-amber-500 shadow-lg">
                        <i className={`fa-solid ${p.classType === 'Warrior' ? 'fa-shield' : p.classType === 'Mage' ? 'fa-wand-sparkles' : 'fa-dagger'}`}></i>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => joinRaid(raid.id)}
                    className="w-full bg-slate-700 hover:bg-amber-600 group-hover:bg-amber-600 py-4 rounded-xl transition-all fantasy-font tracking-widest shadow-inner"
                  >
                    JOIN RAID
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
