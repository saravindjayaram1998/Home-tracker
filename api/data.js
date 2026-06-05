import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TASKS_KEY = 'tracker:tasks';
const TICKS_KEY = 'tracker:ticks';
const PEOPLE = ['Shikha', 'Aravind'];

// Google login (optional). Set these as Vercel Environment Variables to switch login ON.
// GOOGLE_CLIENT_ID  = your OAuth client id
// APPROVED_EMAILS   = comma separated allowed gmails, e.g. "shikha@gmail.com,aravind@gmail.com"
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPROVED = (process.env.APPROVED_EMAILS || '')
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

const DEFAULT_TASKS = [
  {id:"k1", time:"Day", cat:"Kitchen & Food", owner:"Shikha",  txt:"Buy daily grocery (online / market)", rec:{type:"daily"}, status:"active"},
  {id:"k2", time:"Day", cat:"Kitchen & Food", owner:"Shikha",  txt:"Plan bf, lunch, dinner & manage the cook", rec:{type:"daily"}, status:"active"},
  {id:"k3", time:"Morning", cat:"Kitchen & Food", owner:"Both",    txt:"Pack lunch (as possible for each other)", rec:{type:"daily"}, status:"active"},
  {id:"k4", time:"Night",   cat:"Kitchen & Food", owner:"Aravind", txt:"Clean kitchen at night & pack leftover food in fridge", rec:{type:"daily"}, status:"active"},
  {id:"k5", time:"Night",   cat:"Kitchen & Food", owner:"Aravind", txt:"Prepare sauf water every night", rec:{type:"daily"}, status:"active"},
  {id:"k6", time:"Night",   cat:"Kitchen & Food", owner:"Aravind", txt:"Keep used empty lunch box into sink at night", rec:{type:"daily"}, status:"active"},
  {id:"c1", time:"Morning", cat:"Cleaning & Upkeep", owner:"Aravind", txt:"Upkeep bed in morning after wake up", rec:{type:"daily"}, status:"active"},
  {id:"c2", time:"Day",     cat:"Cleaning & Upkeep", owner:"Shikha",  txt:"Supervise maid", rec:{type:"daily"}, status:"active"},
  {id:"c3", time:"Morning", cat:"Cleaning & Upkeep", owner:"Shikha",  txt:"Keep garbage bags outside for pickup", rec:{type:"daily"}, status:"active"},
  {id:"c4", time:"Night",   cat:"Cleaning & Upkeep", owner:"Aravind", txt:"Daily laundry check (load machine, hang wet clothes)", rec:{type:"daily"}, status:"active"},
  {id:"c5", time:"Night",   cat:"Cleaning & Upkeep", owner:"Aravind", txt:"Fold dried clothes and place in shelves", rec:{type:"daily"}, status:"active"},
  {id:"c6", time:"Morning", cat:"Cleaning & Upkeep", owner:"Aravind", txt:"Sunday bedsheet change in both rooms", rec:{type:"weekly", dow:[0]}, status:"active"},
  {id:"c7", time:"Day",     cat:"Cleaning & Upkeep", owner:"Shikha",  txt:"Weekly cleanup of sofa, TV, dining table (Colin, brush)", rec:{type:"weekly", dow:[0]}, status:"active"},
  {id:"c8", time:"Morning", cat:"Cleaning & Upkeep", owner:"Shikha",  txt:"Water plants (Mon, Wed, Fri)", rec:{type:"weekly", dow:[1,3,5]}, status:"active"},
  {id:"c9", time:"Day",     cat:"Cleaning & Upkeep", owner:"Aravind", txt:"Adhoc cleaning of hall / rooms whenever cluttered", rec:{type:"adhoc"}, status:"active"},
  {id:"m1", time:"Day", cat:"Money & Bills", owner:"Shikha", txt:"Monthly rent payment", rec:{type:"monthly"}, status:"active"},
  {id:"m2", time:"Day", cat:"Money & Bills", owner:"Shikha", txt:"Electricity bill", rec:{type:"monthly"}, status:"active"},
  {id:"m3", time:"Day", cat:"Money & Bills", owner:"Shikha", txt:"Pay cook (monthly)", rec:{type:"monthly"}, status:"active"},
  {id:"m4", time:"Day", cat:"Money & Bills", owner:"Shikha", txt:"Pay maid (monthly)", rec:{type:"monthly"}, status:"active"},
  {id:"m5", time:"Day", cat:"Money & Bills", owner:"Shikha", txt:"Wifi bill", rec:{type:"monthly"}, status:"active"},
];

function bothApproved(t){ const a = t.approvals || {}; return PEOPLE.every(p => a[p]); }

// Verify Google login when CLIENT_ID is configured. If not configured, auth is OFF (open).
async function authed(req){
  if(!CLIENT_ID) return true;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if(!token) return false;
  try{
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if(!r.ok) return false;
    const info = await r.json();
    if(info.aud !== CLIENT_ID) return false;
    if(APPROVED.length && !APPROVED.includes((info.email || '').toLowerCase())) return false;
    return true;
  }catch(e){ return false; }
}

export default async function handler(req, res) {
  try {
    if(!(await authed(req))) return res.status(401).json({ error: 'unauthorized' });

    if (req.method === 'GET') {
      let tasks = await redis.get(TASKS_KEY);
      if (!tasks) { tasks = DEFAULT_TASKS; await redis.set(TASKS_KEY, tasks); }
      const ticks = (await redis.hgetall(TICKS_KEY)) || {};
      return res.status(200).json({ tasks, ticks });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      if (body.type === 'toggle' && body.key) {
        if (body.on) await redis.hset(TICKS_KEY, { [body.key]: 1 });
        else await redis.hdel(TICKS_KEY, body.key);
        return res.status(200).json({ ok: true });
      }

      if (body.type === 'subscribe' && body.sub && body.sub.endpoint) {
        await redis.hset('tracker:subs', { [body.sub.endpoint]: JSON.stringify({ person: body.person || '', sub: body.sub }) });
        return res.status(200).json({ ok: true });
      }
      if (body.type === 'unsubscribe' && body.endpoint) {
        await redis.hdel('tracker:subs', body.endpoint);
        return res.status(200).json({ ok: true });
      }

      if (['addTask', 'removeTask', 'approve'].includes(body.type)) {
        let tasks = (await redis.get(TASKS_KEY)) || [];
        if (body.type === 'addTask' && body.task) tasks.push(body.task);
        if (body.type === 'removeTask' && body.id) tasks = tasks.filter(t => t.id !== body.id);
        if (body.type === 'approve' && body.id && PEOPLE.includes(body.person)) {
          const t = tasks.find(x => x.id === body.id);
          if (t) { t.approvals = t.approvals || {}; t.approvals[body.person] = 1; if (bothApproved(t)) t.status = 'active'; }
        }
        await redis.set(TASKS_KEY, tasks);
        return res.status(200).json({ ok: true, tasks });
      }

      return res.status(400).json({ error: 'unknown request' });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
