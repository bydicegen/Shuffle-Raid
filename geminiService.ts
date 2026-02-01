
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateEncounterText = async (enemyName: string, action: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short, immersive D&D style description (max 2 sentences) for a combat encounter where a ${enemyName} is ${action}.`,
    });
    return response.text || "The air grows heavy with the scent of ozone and ancient magic.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "A fierce clash echoes through the dungeon corridors.";
  }
};

export const generateEnemy = async (level: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a JSON for a D&D enemy suitable for level ${level}. 
      Response must be ONLY JSON with fields: name, hp, damage, description, intent (one of: Attack, Defend, Buff).`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return {
      name: "Dungeon Skeleton",
      hp: 30 + level * 5,
      damage: 5 + level * 2,
      description: "A rattling collection of bones bound by spiteful magic.",
      intent: "Attack"
    };
  }
};
