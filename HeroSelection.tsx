
import React from 'react';
import { Hero, HeroClass } from './types';
import { INITIAL_CARDS } from './cards';
import { User } from 'firebase/auth';

interface Props {
  onSelect: (hero: Hero) => void;
  user: User;
}

const CLASSES: { type: HeroClass; icon: string; desc: string; stats: any }[] = [
  { type: 'Warrior', icon: 'fa-shield-halved', desc: 'Masters of defense and brute force.', stats: { hp: 100, mana: 3 } },
  { type: 'Mage', icon: 'fa-wand-sparkles', desc: 'Wielders of arcane devastation.', stats: { hp: 60, mana: 6 } },
  { type: 'Rogue', icon: 'fa-dagger', desc: 'Silent, deadly, and evasive.', stats: { hp: 80, mana: 4 } },
];

const HeroSelection: React.FC<Props> = ({ onSelect, user }) => {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <h2 className="text-4xl text-amber-500 fantasy-font text-center mb-12 tracking-widest">Choose Your Champion</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {CLASSES.map((cls) => (
          <div 
            key={cls.type}
            className="bg-slate-800 border-2 border-slate-700 hover:border-amber-500 rounded-2xl p-8 transition-all cursor-pointer group flex flex-col shadow-xl hover:shadow-amber-500/10"
            onClick={() => onSelect({
              uid: user.uid,
              name: user.email?.split('@')[0] || 'Unknown',
              classType: cls.type,
              hp: cls.stats.hp,
              maxHp: cls.stats.hp,
              mana: cls.stats.mana,
              maxMana: cls.stats.mana,
              xp: 0,
              level: 1,
              deck: INITIAL_CARDS[cls.type]
            })}
          >
            <div className="text-7xl text-amber-600 mb-6 text-center group-hover:scale-110 group-hover:text-amber-400 transition-all duration-500">
              <i className={`fa-solid ${cls.icon}`}></i>
            </div>
            <h3 className="text-3xl fantasy-font text-white text-center mb-4">{cls.type}</h3>
            <p className="text-slate-400 text-center mb-8 flex-grow leading-relaxed italic">"{cls.desc}"</p>
            <div className="space-y-3 mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between text-sm uppercase tracking-tighter">
                <span className="text-slate-500">Vitality</span>
                <span className="text-red-400 font-black">{cls.stats.hp} HP</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-600" style={{ width: '100%' }}></div>
              </div>
              <div className="flex justify-between text-sm uppercase tracking-tighter pt-2">
                <span className="text-slate-500">Essence</span>
                <span className="text-blue-400 font-black">{cls.stats.mana} Mana</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: '100%' }}></div>
              </div>
            </div>
            <button className="w-full bg-slate-700 group-hover:bg-amber-600 py-4 rounded-xl fantasy-font tracking-widest transition-all shadow-lg">
              SELECT CLASS
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroSelection;
