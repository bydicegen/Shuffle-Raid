
import { Card, HeroClass } from './types';

export const INITIAL_CARDS: Record<HeroClass, Card[]> = {
  Warrior: [
    { id: 'w1', name: 'Heavy Strike', type: 'Attack', value: 8, cost: 2, description: 'A crushing blow.', icon: 'fa-hammer' },
    { id: 'w2', name: 'Quick Bash', type: 'Attack', value: 5, cost: 1, description: 'A fast attack.', icon: 'fa-hand-fist' },
    { id: 'w3', name: 'Iron Guard', type: 'Defend', value: 7, cost: 1, description: 'Raise your shield.', icon: 'fa-shield-halved' },
    { id: 'w4', name: 'Iron Guard', type: 'Defend', value: 7, cost: 1, description: 'Raise your shield.', icon: 'fa-shield-halved' },
    { id: 'w5', name: 'Second Wind', type: 'Heal', value: 10, cost: 2, description: 'Push through the pain.', icon: 'fa-heart-pulse' },
  ],
  Mage: [
    { id: 'm1', name: 'Fireball', type: 'Attack', value: 12, cost: 3, description: 'Burn them all.', icon: 'fa-fire' },
    { id: 'm2', name: 'Arcane Bolt', type: 'Attack', value: 6, cost: 1, description: 'Pure energy.', icon: 'fa-bolt' },
    { id: 'm3', name: 'Mana Shield', type: 'Defend', value: 10, cost: 2, description: 'Magical barrier.', icon: 'fa-sun' },
    { id: 'm4', name: 'Arcane Bolt', type: 'Attack', value: 6, cost: 1, description: 'Pure energy.', icon: 'fa-bolt' },
    { id: 'm5', name: 'Meditation', type: 'Heal', value: 8, cost: 1, description: 'Focus your mind.', icon: 'fa-brain' },
  ],
  Rogue: [
    { id: 'r1', name: 'Backstab', type: 'Attack', value: 10, cost: 2, description: 'A sneaky strike.', icon: 'fa-dagger' },
    { id: 'r2', name: 'Twin Slash', type: 'Attack', value: 4, cost: 1, description: 'Hit twice.', icon: 'fa-scissors' },
    { id: 'r3', name: 'Twin Slash', type: 'Attack', value: 4, cost: 1, description: 'Hit twice.', icon: 'fa-scissors' },
    { id: 'r4', name: 'Evasion', type: 'Defend', value: 5, cost: 1, description: 'Dodge the hit.', icon: 'fa-wind' },
    { id: 'r5', name: 'Vanish', type: 'Special', value: 0, cost: 2, description: 'Enter shadows.', icon: 'fa-ghost' },
  ]
};
