const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;
const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;

function attachDashboard(client) {
  const sessions = new Map();
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bot Control Center</title><style>
  :root{color-scheme:dark;--bg:#090d12;--panel:#111923;--panel2:#172330;--line:#263746;--green:#45e0a0;--muted:#9db0c0;--text:#edf6f7;--red:#ff697a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 90% 0,#12372f 0,transparent 35%),var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer;border:0;border-radius:12px;padding:12px 16px;background:var(--green);color:#062017;font-weight:800}button:disabled{opacity:.5;cursor:not-allowed}.shell{max-width:1180px;margin:auto;padding:22px}.top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:12px}.logo{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--green);color:#062017;font-weight:1000;font-size:21px}.muted{color:var(--muted)}.layout{display:grid;grid-template-columns:240px 1fr;gap:18px;margin-top:26px}.side,.panel,.stat{background:linear-gradient(145deg,#121c26,#0e151d);border:1px solid var(--line);border-radius:20px}.side{padding:16px;height:max-content}.nav{display:block;text-align:right;width:100%;background:transparent;color:var(--muted);margin:5px 0}.nav.active,.nav:hover{background:var(--panel2);color:var(--green)}.content{min-width:0}.hero{padding:24px;margin-bottom:16px}.panel{padding:20px;margin-bottom:16px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.stat{padding:18px}.num{font-size:27px;font-weight:900;color:var(--green);margin-top:8px}label{display:block;font-weight:750;margin:12px 0 7px}input,select,textarea{width:100%;padding:12px;border-radius:11px;border:1px solid var(--line);background:#091119;color:var(--text);outline:none}input:focus,select:focus,textarea:focus{border-color:var(--green)}textarea{min-height:125px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.status{padding:10px 13px;border-radius:10px;background:#14261f;color:var(--green);margin-top:12px;white-space:pre-wrap}.hidden{display:none!important}.login{max-width:540px;margin:12vh auto;text-align:center;padding:32px}.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 10px;color:var(--muted);font-size:12px}.sectionTitle{display:flex;justify-content:space-between;gap:10px;align-items:center}.small{font-size:13px}.danger{background:#4a2029;color:#ffdce1}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.empty{padding:26px;text-align:center;color:var(--muted)}@media(max-width:760px){.layout{grid-template-columns:1fr}.side{display:flex;overflow:auto;gap:6px}.nav{white-space:nowrap;text-align:center;width:auto}.stats{grid-template-columns:1fr}.row,.cards{grid-template-columns:1fr}.shell{padding:12px}}
  </style></head><body><div class="shell"><header class="top"><div class="brand"><div class="logo">B</div><div><strong>Bot Control Center</strong><div class="muted small">پنل مدیریت سرورهای دیسکورد</div></div></div><div id="userArea" class="muted small"></div></header>
  <section id="login" class="panel login"><div class="logo" style="margin:0 auto 18px">B</div><h1>همه‌چیز زیر کنترل توئه.</h1><p class="muted">با دیسکورد وارد شو، سرور رو انتخاب کن و ابزارهای ربات رو از یک پنل مدیریت کن.</p><button id="loginBtn">ورود با Discord</button><p class="muted small">فقط سرورهایی نمایش داده می‌شن که دسترسی مدیریتی داری و ربات داخلشونه.</p></section>
  <div id="app" class="layout hidden"><aside class="side"><label for="guildSelect">سرور فعال</label><select id="guildSelect"></select><div style="height:14px"></div><button class="nav active" data-page="overview">◈ نمای کلی</button><button class="nav" data-page="hidem">✦ ارسال پیام Hidem</button><button class="nav" data-page="tools">⚡ ابزارها</button><button class="nav" data-page="security">◉ امنیت</button><div style="height:14px"></div><button class="nav" id="logoutBtn">خروج</button></aside><main class="content">
  <section id="overviewPage"><div class="panel hero"><span class="pill">CONTROL CENTER / LIVE</span><h1 id="guildTitle">داشبورد سرور</h1><p class="muted">نمای کلی و ابزارهای مدیریتی ربات در یک جا.</p></div><div class="stats"><div class="stat"><div class="muted">اعضا</div><div class="num" id="members">—</div></div><div class="stat"><div class="muted">کانال‌ها</div><div class="num" id="channels">—</div></div><div class="stat"><div class="muted">نقش‌ها</div><div class="num" id="roles">—</div></div></div><div class="panel"><div class="sectionTitle"><h2>میانبرها</h2><span class="pill">ADMIN</span></div><div class="cards"><button data-goto="hidem">ارسال پیام با Hidem</button><button data-goto="tools">مشاهده ابزارها</button></div></div></section>
  <section id="hidemPage" class="hidden"><div class="panel"><h1>✦ Hidem Message</h1><p class="muted">پیام را با هویت خود ربات در کانال انتخاب‌شده ارسال کن.</p><form id="hidemForm"><label>کانال مقصد</label><select id="channelSelect" required></select><label>متن پیام</label><textarea id="hidemMessage" maxlength="2000" required placeholder="پیام خودت رو اینجا بنویس..."></textarea><div style="margin-top:14px"><button style="width:100%" type="submit">ارسال پیام ↗</button></div><div id="hidemStatus" class="status hidden"></div></form></div></section>
  <section id="toolsPage" class="hidden"><div class="panel"><h1>⚡ ابزارهای مدیریتی</h1><p class="muted">این بخش برای اضافه‌شدن کنترل‌های وبی امکانات ربات آماده شده.</p><div class="cards"><div class="stat"><strong>مدیریت پیام</strong><p class="muted small">ارسال پیام با Hidem از طریق پنل.</p><button data-goto="hidem">باز کردن</button></div><div class="stat"><strong>Trial Moderator</strong><p class="muted small">پنل درخواست‌های TMPS و بررسی وضعیت.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>مدیریت اعضا</strong><p class="muted small">ابزارهای مدیریت اعضا و نقش‌ها.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>لاگ و آمار</strong><p class="muted small">آمار سرور و فعالیت‌های ربات.</p><span class="pill">در مرحله بعد</span></div></div></div></section>
  <section id="securityPage" class="hidden"><div class="panel"><h1>◉ امنیت پنل</h1><p>ورود با OAuth دیسکورد انجام می‌شود. عملیات مدیریتی فقط برای ادمین‌های سرور مجاز است و رمز Hidem سمت سرور بررسی می‌شود.</p><p class="muted small">توکن ربات هرگز به مرورگر ارسال نمی‌شود.</p></div></section>
  </main></div></div><script>
  const $=id=>document.getElementById(id);let guilds=[],activeGuild=null,csrf='';
  async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({error:'پاسخ نامعتبر سرور'}));if(!r.ok)throw new Error(d.error||'درخواست ناموفق بود');return d}
  function showPage(name){['overview','hidem','tools','security'].forEach(p=>$(p+'Page').classList.toggle('hidden',p!==name));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name))}
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
  async function loadGuild(){activeGuild=$('guildSelect').value;const g=guilds.find(x=>x.id===activeGuild);if(!g)return;$('guildTitle').textContent=g.name;const d=await api('/api/guild/'+activeGuild);$('members').textContent=d.memberCount??'—';$('channels').textContent=d.channels.length;$('roles').textContent=d.roles.length;$('channelSelect').innerHTML=d.channels.map(c=>'<option value="'+c.id+'"># '+esc(c.name)+'</option>').join('')}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function init(){try{const d=await api('/api/me');if(!d.user){$('login').classList.remove('hidden');return}csrf=d.csrf;$('login').classList.add('hidden');$('app').classList.remove('hidden');$('userArea').textContent=d.user.username+' • Discord';guilds=await api('/api/guilds');$('guildSelect').innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');if(!guilds.length){$('guildTitle').textContent='سرور مدیریتی پیدا نشد';return}await loadGuild()}catch(e){$('login').classList.remove('hidden');$('userArea').textContent=e.message}}
  $('loginBtn').onclick=()=>location.href='/auth/discord';$('logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST',body:JSON.stringify({csrf})});location.reload()};$('guildSelect').onchange=()=>loadGuild().catch(e=>alert(e.message));
  $('hidemForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const st=$('hidemStatus');st.classList.remove('hidden');st.textContent='در حال ارسال...';try{const d=await api('/api/hidem',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,channelId:$('channelSelect').value,message:$('hidemMessage').value,})});st.textContent=d.message;$('hidemMessage').value='';$('hidemPassword').value=''}catch(err){st.textContent='خطا: '+err.message}finally{b.disabled=false}};
  init();
  </script></body></html>`;

  function cookieValue(req, name) {
    const row = (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
    return row ? decodeURIComponent(row.slice(name.length + 1)) : null;
  }
  function signed(value) {
    return crypto.createHmac("sha256", SESSION_SECRET || "missing-secret").update(value).digest("hex");
  }
  function sessionFor(req) {
    const raw = cookieValue(req, "botdash");
    if (!raw) return null;
    const [id, sig] = raw.split(".");
    if (!id || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signed(id)))) return null;
    const s = sessions.get(id);
    if (!s || s.expires < Date.now()) { sessions.delete(id); return null; }
    return s;
  }
  function send(res, status, data) {
    res.writeHead(status, {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    let data = "";
    for await (const chunk of req) { data += chunk; if (data.length > 12000) throw new Error("درخواست بیش از حد بزرگ است."); }
    return data ? JSON.parse(data) : {};
  }
  function adminGuilds(userGuilds, userId) {
    // Discord OAuth returns the user's effective guild permissions. Do not rely on
    // the bot's member cache here: it often does not contain the dashboard user,
    // which incorrectly made every eligible server disappear.
    return userGuilds.filter(g => {
      const perms = BigInt(g.permissions || "0");
      if (!(perms & 8n) && !(perms & 32n)) return false;
      return client.guilds.cache.has(g.id);
    }).map(g => ({id:g.id,name:g.name,icon:g.icon ? "https://cdn.discordapp.com/icons/"+g.id+"/"+g.icon+".png" : null}));
  }
  const server = http.createServer(async (req,res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, {"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' https://cdn.discordapp.com"});
      res.end(html); return;
    }
    if (req.method === "GET" && url.pathname === "/auth/discord") {
      if (!CLIENT_ID || !CLIENT_SECRET || !SESSION_SECRET || !REDIRECT_URI) { res.writeHead(503,{"content-type":"text/plain; charset=utf-8"});res.end("Dashboard OAuth is not configured. Set CLIENT_ID, DISCORD_CLIENT_SECRET, DASHBOARD_SESSION_SECRET and DASHBOARD_REDIRECT_URI.");return; }
      const state=crypto.randomBytes(24).toString("hex");
      const nonce=crypto.randomBytes(24).toString("hex");
      const id=crypto.randomBytes(24).toString("hex");
      sessions.set(id,{state,nonce,csrf:crypto.randomBytes(24).toString("hex"),expires:Date.now()+10*60*1000,oauthPending:true});
      res.writeHead(302,{location:"https://discord.com/oauth2/authorize?"+new URLSearchParams({client_id:CLIENT_ID,response_type:"code",redirect_uri:REDIRECT_URI,scope:"identify guilds",state}),"set-cookie":"botdash="+encodeURIComponent(id+"."+signed(id))+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600"});
      res.end(); return;
    }
    if (req.method === "GET" && url.pathname === "/auth/callback") {
      const s=sessionFor(req);
      if (!s || !s.oauthPending || !url.searchParams.get("code") || url.searchParams.get("state")!==s.state) { res.writeHead(400,{"content-type":"text/plain"});res.end("OAuth state check failed. Return to the dashboard and sign in again.");return; }
      try {
        const tokenResponse=await fetch("https://discord.com/api/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:"authorization_code",code:url.searchParams.get("code"),redirect_uri:REDIRECT_URI})});
        const token=await tokenResponse.json();if(!tokenResponse.ok)throw new Error("Discord OAuth token exchange failed");
        const meResponse=await fetch("https://discord.com/api/users/@me",{headers:{authorization:"Bearer "+token.access_token}});
        const user=await meResponse.json();if(!meResponse.ok)throw new Error("Discord profile lookup failed");
        const guildResponse=await fetch("https://discord.com/api/users/@me/guilds",{headers:{authorization:"Bearer "+token.access_token}});
        const userGuilds=await guildResponse.json();if(!guildResponse.ok)throw new Error("Discord server lookup failed");
        s.user=user;s.userGuilds=userGuilds;s.oauthPending=false;s.expires=Date.now()+8*60*60*1000;s.csrf=crypto.randomBytes(24).toString("hex");
        res.writeHead(302,{"location":"/","set-cookie":"botdash="+encodeURIComponent(cookieValue(req,"botdash"))+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800"});res.end();
      } catch(e) { console.error("[dashboard] OAuth error:",e.message);res.writeHead(502,{"content-type":"text/plain; charset=utf-8"});res.end("Discord login failed. Please return to the dashboard and try again."); }
      return;
    }
    const s=sessionFor(req);
    if (url.pathname.startsWith("/api/")) {
      if (req.method==="GET" && url.pathname==="/api/me") { send(res,200,{user:s?.user?{id:s.user.id,username:s.user.username,avatar:s.user.avatar}:null,csrf:s?.csrf||null});return; }
      if (req.method==="POST" && url.pathname==="/api/logout") { try {const b=await body(req);if(!s||b.csrf!==s.csrf)return send(res,403,{error:"نشست معتبر نیست."});}catch{return send(res,400,{error:"درخواست نامعتبر است."})}const id=cookieValue(req,"botdash")?.split(".")[0];if(id)sessions.delete(id);res.writeHead(200,{"content-type":"application/json","set-cookie":"botdash=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});res.end(JSON.stringify({ok:true}));return; }
      if (!s?.user || s.oauthPending) return send(res,401,{error:"ابتدا با Discord وارد شو."});
      if (req.method==="GET" && url.pathname==="/api/guilds") { send(res,200,adminGuilds(s.userGuilds,s.user.id));return; }
      const guildMatch=url.pathname.match(/^\/api\/guild\/([0-9]{17,20})$/);
      if(req.method==="GET"&&guildMatch){const g=client.guilds.cache.get(guildMatch[1]);if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});await g.channels.fetch().catch(()=>{});await g.roles.fetch().catch(()=>{});send(res,200,{memberCount:g.memberCount,channels:g.channels.cache.filter(c=>(c.type===0||c.type===5)&&c.viewable&&c.permissionsFor(g.members.me)?.has("SendMessages")).map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.name.localeCompare(b.name)),roles:g.roles.cache.map(r=>({id:r.id,name:r.name}))});return;}
      if(req.method==="POST"&&url.pathname==="/api/hidem"){let b;try{b=await body(req)}catch(e){return send(res,400,{error:e.message||"درخواست نامعتبر است."})}if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});const g=client.guilds.cache.get(String(b.guildId));if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});const member=await g.members.fetch(s.user.id).catch(()=>null);if(!member||!member.permissions.has("Administrator"))return send(res,403,{error:"فقط ادمین سرور می‌تواند این کار را انجام دهد."});const ch=g.channels.cache.get(String(b.channelId));if(!ch||![0,5].includes(ch.type)||!ch.isTextBased())return send(res,400,{error:"کانال مقصد معتبر نیست."});if(!ch.permissionsFor(g.members.me)?.has("SendMessages"))return send(res,403,{error:"ربات اجازه ارسال پیام در این کانال را ندارد."});const message=String(b.message||"").trim();if(!message||message.length>2000)return send(res,400,{error:"متن پیام باید بین 1 تا 2000 کاراکتر باشد."});try{await ch.send({content:message,allowedMentions:{parse:[]}});send(res,200,{ok:true,message:"پیام با موفقیت ارسال شد."});}catch(e){console.error("[dashboard] Hidem send failed:",e.message);send(res,500,{error:"ارسال پیام ناموفق بود؛ دسترسی‌های کانال را بررسی کن."});}return;}
      return send(res,404,{error:"مسیر پیدا نشد."});
    }
    res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
  });
  server.on("error",e=>console.error("[dashboard] Server error:",e));
  server.listen(PORT,"0.0.0.0",()=>console.log("[dashboard] Listening on port "+PORT));
}
module.exports={attachDashboard};
