
import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border-2 border-amber-600/50 rounded-xl p-8 shadow-2xl">
        <h1 className="text-4xl fantasy-font text-amber-500 text-center mb-8 tracking-wider">
          Chronicles of Eldritch
        </h1>
        
        {error && <p className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</p>}
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1 uppercase tracking-tighter">Email Scroll</label>
            <input 
              type="email" 
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 focus:outline-none focus:border-amber-500 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1 uppercase tracking-tighter">Secret Cipher</label>
            <input 
              type="password" 
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 focus:outline-none focus:border-amber-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg fantasy-font tracking-widest active:scale-95"
          >
            {isRegistering ? 'EMBARK ON QUEST' : 'REJOIN THE REALM'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          {isRegistering ? 'Already have a hero?' : 'New to these lands?'}
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="ml-2 text-amber-500 hover:underline font-bold"
          >
            {isRegistering ? 'Login' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
