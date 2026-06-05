import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const PEOPLE = ['Shikha', 'Aravind'];
const DEFAULT_TASKS = [
  {id:"k1",time:"Day",owner:"Shikha",rec:{type:"daily"},status:"active"},
  {id:"k2",time:"Day",owner:"Shikha",rec:{type:"daily"},status:"active"},
  {id:"k3",time:"Morning",owner:"Both",rec:{type:"daily"},status:"active"},
  {id:"k4",time:"Night",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"k5",time:"Night",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"k6",time:"Night",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"c1",time:"Morning",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"c2",time:"Day",owner:"Shikha",rec:{type:"daily"},status:"active"},
  {id:"c3",time:"Morning",owner:"Shikha",rec:{type:"daily"},status:"active"},
  {id:"c4",time:"Night",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"c5",time:"Night",owner:"Aravind",rec:{type:"daily"},status:"active"},
  {id:"c6",time:"Morning",owner:"Aravind",rec:{type:"weekly",dow:[0]},status:"active"},
  {id:"c7",time:"Day",owner:"Shikha",rec:{type:"weekly",dow:[0]},status:"active"},
  {id:"c8",time:"Morning",owner:"Shikha",rec:{type:"weekly",dow:[1,3,5]},status:"active"},
  {id:"c9",time:"Day",owner:"Aravind",rec:{type:"adhoc"},status:"active"},
];

// IST wall-clock date (UTC+5:30)
function istNow(){ return new Date(Date.now() + 5.5 * 3600 * 1000); }
function iso(d){ return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0"); }

function pendingFor(person, tasks, ticks){
  const d = istNow(), dow = d.getUTCDay(), today = iso(d);
  const scheduled = tasks.filter(t=>{
    if(t.status==='pending') return false;
    const r=t.rec||{type:'daily'};
    if(r.type==='daily') return true;
    if(r.type==='weekly') return (r.dow||[]).includes(dow);
    return false; // adhoc + monthly not counted as daily pending
  }).filter(t => t.owner===person || t.owner==='Both');
  return scheduled.filter(t => !ticks[today+"::"+t.id]).length;
}

export default async function handler(req, res){
  // only allow Vercel Cron (or a matching secret) to trigger this
  const secret = process.env.CRON_SECRET;
  if(secret){
    const auth = req.headers.authorization || '';
    if(auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'unauthorized' });
  }

  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if(!pub || !priv) return res.status(200).json({ ok:true, note:'push not configured' });
  webpush.setVapidDetails('mailto:home-tracker@example.com', pub, priv);

  const tasks = (await redis.get('tracker:tasks')) || DEFAULT_TASKS;
  const ticks = (await redis.hgetall('tracker:ticks')) || {};
  const subsRaw = (await redis.hgetall('tracker:subs')) || {};

  let sent = 0, removed = 0;
  for(const endpoint of Object.keys(subsRaw)){
    let entry; try{ entry = typeof subsRaw[endpoint]==='string'? JSON.parse(subsRaw[endpoint]) : subsRaw[endpoint]; }catch(e){ continue; }
    const person = entry.person, sub = entry.sub;
    if(!sub || !PEOPLE.includes(person)) continue;
    if(pendingFor(person, tasks, ticks) <= 0) continue; // only notify if something is actually pending
    try{
      await webpush.sendNotification(sub, JSON.stringify({ title:'Home Tracker', body:'You have some pending activities.' }));
      sent++;
    }catch(err){
      if(err && (err.statusCode===404 || err.statusCode===410)){ await redis.hdel('tracker:subs', endpoint); removed++; }
    }
  }
  return res.status(200).json({ ok:true, sent, removed });
}
