
export type HeroClass = 'Warrior' | 'Mage' | 'Rogue';

export interface Card {
  id: string;
  name: string;
  type: 'Attack' | 'Defend' | 'Heal' | 'Special';
  value: number;
  cost: number;
  description: string;
  icon: string;
}

export interface Hero {
  uid: string;
  name: string;
  classType: HeroClass;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  xp: number;
  level: number;
  deck: Card[];
}

export interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  description: string;
  intent: 'Attack' | 'Defend' | 'Buff';
}

export interface RaidSession {
  id: string;
  hostId: string;
  players: Record<string, Hero>;
  status: 'lobby' | 'combat' | 'event' | 'victory' | 'defeat' | 'reward';
  currentEnemy?: Enemy | null;
  turnOwnerId: string;
  turnNumber: number;
  log: string[];
}
