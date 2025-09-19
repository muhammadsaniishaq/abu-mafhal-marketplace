'use client';
import { useState } from 'react';


export default function Notifications(){
const [title,setTitle]=useState('');
const [body,setBody]=useState('');
const [target,setTarget]=useState<'all'|'role'|'user'>('all');
const [value,setValue]=useState('');


async function send(){
const res = await fetch('/api/notifications/fcm',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, body, target, value }) });
const json = await res.json(); alert('Sent'); console.log(json);
}


return (
<div className="space-y-3">
<h1 className="text-2xl font-bold">Notifications</h1>
<input className="border p-2 w-full" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
<textarea className="border p-2 w-full" placeholder="Body" value={body} onChange={e=>setBody(e.target.value)} />
<div className="flex gap-2">
<select value={target} onChange={e=>setTarget(e.target.value as any)} className="border p-2">
<option value="all">All users</option>
<option value="role">By role</option>
<option value="user">Specific userId</option>
</select>
<input className="border p-2 flex-1" placeholder="role or userId (if applicable)" value={value} onChange={e=>setValue(e.target.value)} />
</div>
<button onClick={send} className="px-3 py-2 border rounded">Send Push</button>
</div>
);
}