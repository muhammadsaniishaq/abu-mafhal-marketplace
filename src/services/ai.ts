// src/services/ai.ts
'use client';
export async function gemini(task: string, prompt?: string, context?: any) {
const r = await fetch('/api/ai/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, prompt, context }) });
if (!r.ok) throw new Error('Gemini error');
return await r.json();
}