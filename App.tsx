
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AuthScreen from './AuthScreen';
import HeroSelection from './HeroSelection';
import GameBoard from './GameBoard';
import Lobby from './Lobby';
import { Hero } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [raidId, setRaidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const heroDoc = await getDoc(doc(db, 'users', u.uid));
        if (heroDoc.exists()) {
          setHero(heroDoc.data() as Hero);
        }
      } else {
        setHero(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleHeroSelected = async (newHero: Hero) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), newHero);
    setHero(newHero);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-amber-500 text-3xl fantasy-font animate-pulse">
      Summoning the Realm...
    </div>
  );

  if (!user) return <AuthScreen />;
  if (!hero) return <HeroSelection onSelect={handleHeroSelected} user={user} />;
  
  if (!raidId) return <Lobby user={user} hero={hero} onJoinRaid={setRaidId} />;

  return <GameBoard raidId={raidId} hero={hero} onLeave={() => setRaidId(null)} />;
};

export default App;
