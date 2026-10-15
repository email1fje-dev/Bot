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
  <div id="app" class="layout hidden"><aside class="side"><label for="guildSelect">سرور فعال</label><select id="guildSelect"></select><div style="height:14px"></div><button class="nav active" data-page="overview">◈ نمای کلی</button><button class="nav" data-page="hidem">✦ ارسال پیام Hidem</button><button class="nav" data-page="tools">⚡ ابزارها</button><button class="nav" data-page="members">🛡️ اعضا</button><button class="nav" data-page="embed">✉️ Embed</button><button class="nav" data-page="community">🎫 تیکت و نقش</button><button class="nav" data-page="security">◉ امنیت</button><div style="height:14px"></div><button class="nav" id="logoutBtn">خروج</button></aside><main class="content">
  <section id="overviewPage"><div class="panel hero"><span class="pill">CONTROL CENTER / LIVE</span><h1 id="guildTitle">داشبورد سرور</h1><p class="muted">نمای کلی و ابزارهای مدیریتی ربات در یک جا.</p></div><div class="stats"><div class="stat"><div class="muted">اعضا</div><div class="num" id="members">—</div></div><div class="stat"><div class="muted">کانال‌ها</div><div class="num" id="channels">—</div></div><div class="stat"><div class="muted">نقش‌ها</div><div class="num" id="roles">—</div></div></div><div class="panel"><div class="sectionTitle"><h2>میانبرها</h2><span class="pill">ADMIN</span></div><div class="cards"><button data-goto="hidem">ارسال پیام با Hidem</button><button data-goto="tools">مشاهده ابزارها</button></div></div></section>
  <section id="hidemPage" class="hidden"><div class="panel"><h1>✦ Hidem Message</h1><p class="muted">پیام را با هویت خود ربات در کانال انتخاب‌شده ارسال کن.</p><form id="hidemForm"><label>کانال مقصد</label><select id="channelSelect" required></select><label>متن پیام</label><textarea id="hidemMessage" maxlength="2000" required placeholder="پیام خودت رو اینجا بنویس..."></textarea><div style="margin-top:14px"><button style="width:100%" type="submit">ارسال پیام ↗</button></div><div id="hidemStatus" class="status hidden"></div></form></div></section>
  <section id="toolsPage" class="hidden"><div class="panel"><h1>⚡ ابزارهای مدیریتی</h1><p class="muted">این بخش برای اضافه‌شدن کنترل‌های وبی امکانات ربات آماده شده.</p><div class="cards"><div class="stat"><strong>مدیریت پیام</strong><p class="muted small">ارسال پیام با Hidem از طریق پنل.</p><button data-goto="hidem">باز کردن</button></div><div class="stat"><strong>Trial Moderator</strong><p class="muted small">پنل درخواست‌های TMPS و بررسی وضعیت.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>مدیریت اعضا</strong><p class="muted small">ابزارهای مدیریت اعضا و نقش‌ها.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>لاگ و آمار</strong><p class="muted small">آمار سرور و فعالیت‌های ربات.</p><span class="pill">در مرحله بعد</span></div></div></div></section>
  <section id="membersPage" class="hidden"><div class="panel"><h1>🛡️ مدیریت اعضا</h1><p class="muted">شناسه کاربر را وارد کن. عملیات حساس قبل از اجرا تأیید می‌خواهد.</p><form id="modForm"><label>شناسه کاربر</label><input id="modUser" inputmode="numeric" pattern="[0-9]{17,20}" required placeholder="Discord User ID"><label>دلیل</label><input id="modReason" maxlength="400" placeholder="دلیل اقدام"><div class="row"><div><label>اقدام</label><select id="modAction"><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option><option value="unban">Unban</option></select></div><div><label>مدت Timeout (دقیقه)</label><input id="modMinutes" type="number" min="1" max="40320" value="10"></div></div><button style="margin-top:14px" type="submit">اجرای اقدام</button><div id="modStatus" class="status hidden"></div></form></div></section>
<section id="embedPage" class="hidden"><div class="panel"><h1>✉️ سازنده Embed</h1><form id="embedForm"><label>کانال مقصد</label><select id="embedChannel" required></select><label>عنوان</label><input id="embedTitle" maxlength="256"><label>توضیحات</label><textarea id="embedDescription" maxlength="4000" required></textarea><div class="row"><div><label>رنگ HEX</label><input id="embedColor" value="#45e0a0" pattern="#?[0-9a-fA-F]{6}"></div><div><label>Footer</label><input id="embedFooter" maxlength="2048"></div></div><button style="margin-top:14px" type="submit">ارسال Embed</button><div id="embedStatus" class="status hidden"></div></form></div></section>
<section id="communityPage" class="hidden"><div class="panel"><h1>🎫 پنل راهنمای تیکت</h1><form id="ticketForm"><label>کانال مقصد</label><select id="ticketChannel" required></select><label>عنوان</label><input id="ticketTitle" maxlength="256" value="مرکز پشتیبانی"><label>توضیحات</label><textarea id="ticketText" maxlength="3500" required>برای دریافت پشتیبانی از دستور /ticket استفاده کن.</textarea><button type="submit">ارسال پنل تیکت</button><div id="ticketStatus" class="status hidden"></div></form></div><div class="panel"><h1>🏷️ پنل راهنمای Self-Role</h1><form id="roleForm"><label>کانال مقصد</label><select id="roleChannel" required></select><label>عنوان</label><input id="roleTitle" maxlength="256" value="انتخاب نقش"><label>توضیحات</label><textarea id="roleText" maxlength="3500" required>برای دریافت نقش موردنظر با مدیر سرور هماهنگ کن.</textarea><button type="submit">ارسال پنل نقش</button><div id="roleStatus" class="status hidden"></div></form><p class="muted small">این نسخه پیام راهنما می‌سازد؛ اعطای خودکار نقش از طریق دکمه هنوز فعال نشده.</p></div></section>
<section id="securityPage" class="hidden"><div class="panel"><h1>🛡️ تنظیمات امنیتی</h1><p class="muted">فیلترهای امنیتی موجود بات را برای سرور فعال یا غیرفعال کن.</p><form id="securityForm"><label><input type="checkbox" id="secAntilink" style="width:auto"> حذف لینک‌ها</label><label><input type="checkbox" id="secAntiinvite" style="width:auto"> حذف دعوت‌نامه‌ها</label><label><input type="checkbox" id="secAntispam" style="width:auto"> ضداسپم</label><label><input type="checkbox" id="secAntimention" style="width:auto"> ضدمنشن انبوه</label><label><input type="checkbox" id="secAntiraid" style="width:auto"> هشدار Anti-Raid</label><label><input type="checkbox" id="secAntibot" style="width:auto"> جلوگیری از ورود بات‌ها</label><button type="submit">ذخیره امنیت</button><div id="securityStatus" class="status hidden"></div></form></div><div class="panel"><h2>⚙️ اتوماسیون</h2><form id="automationForm"><label>کانال خوشامدگویی</label><select id="autoWelcome"></select><label>لاگ اعضا</label><select id="autoMemberLog"></select><label>لاگ مدیریت</label><select id="autoModLog"></select><label>لاگ سرور</label><select id="autoServerLog"></select><button type="submit">ذخیره اتوماسیون</button><div id="automationStatus" class="status hidden"></div></form></div></section>
  </main></div></div><script>
  const $=id=>document.getElementById(id);let guilds=[],activeGuild=null,csrf='';
  async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({error:'پاسخ نامعتبر سرور'}));if(!r.ok)throw new Error(d.error||'درخواست ناموفق بود');return d}
  function showPage(name){['overview','hidem','tools','members','embed','community','security'].forEach(p=>$(p+'Page').classList.toggle('hidden',p!==name));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name))}
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
  async function loadGuild(){activeGuild=$('guildSelect').value;const g=guilds.find(x=>x.id===activeGuild);if(!g)return;$('guildTitle').textContent=g.name;const d=await api('/api/guild/'+activeGuild);$('members').textContent=d.memberCount??'—';$('channels').textContent=d.channels.length;$('roles').textContent=d.roles.length;$('channelSelect').innerHTML=d.channels.map(c=>'<option value="'+c.id+'"># '+esc(c.name)+'</option>').join('');['embedChannel','ticketChannel','roleChannel','autoWelcome','autoMemberLog','autoModLog','autoServerLog'].forEach(id=>{const el=$(id);if(el)el.innerHTML=d.channels.map(c=>'<option value="'+c.id+'"># '+esc(c.name)+'</option>').join('')});await loadSettings()}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function init(){try{const d=await api('/api/me');if(!d.user){$('login').classList.remove('hidden');return}csrf=d.csrf;$('login').classList.add('hidden');$('app').classList.remove('hidden');$('userArea').textContent=d.user.username+' • Discord';guilds=await api('/api/guilds');$('guildSelect').innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');if(!guilds.length){$('guildTitle').textContent='سرور مدیریتی پیدا نشد';return}await loadGuild()}catch(e){$('login').classList.remove('hidden');$('userArea').textContent=e.message}}
  $('loginBtn').onclick=()=>location.href='/auth/discord';$('logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST',body:JSON.stringify({csrf})});location.reload()};$('guildSelect').onchange=()=>loadGuild().catch(e=>alert(e.message));
  $('hidemForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const st=$('hidemStatus');st.classList.remove('hidden');st.textContent='در حال ارسال...';try{const d=await api('/api/hidem',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,channelId:$('channelSelect').value,message:$('hidemMessage').value,})});st.textContent=d.message;$('hidemMessage').value='';$('hidemPassword').value=''}catch(err){st.textContent='خطا: '+err.message}finally{b.disabled=false}};

  async function postFeature(path,payload,statusId,confirmText){if(confirmText&&!confirm(confirmText))return;const st=$(statusId);st.classList.remove('hidden');st.textContent='در حال اجرا...';try{const d=await api(path,{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,...payload})});st.textContent=d.message||'انجام شد.'}catch(e){st.textContent='خطا: '+e.message}}
  $('modForm').onsubmit=e=>{e.preventDefault();postFeature('/api/moderation',{userId:$('modUser').value.trim(),reason:$('modReason').value,action:$('modAction').value,minutes:Number($('modMinutes').value)},'modStatus','از اجرای این اقدام مطمئنی؟')};
  $('embedForm').onsubmit=e=>{e.preventDefault();postFeature('/api/embed',{channelId:$('embedChannel').value,title:$('embedTitle').value,description:$('embedDescription').value,color:$('embedColor').value,footer:$('embedFooter').value},'embedStatus')};
  $('ticketForm').onsubmit=e=>{e.preventDefault();postFeature('/api/community-panel',{kind:'ticket',channelId:$('ticketChannel').value,title:$('ticketTitle').value,description:$('ticketText').value},'ticketStatus')};
  $('roleForm').onsubmit=e=>{e.preventDefault();postFeature('/api/community-panel',{kind:'role',channelId:$('roleChannel').value,title:$('roleTitle').value,description:$('roleText').value},'roleStatus')};

  async function loadSettings(){if(!activeGuild)return;try{const c=await api('/api/settings?guildId='+activeGuild);['antilink','antiinvite','antispam','antimention','antiraid','antibot'].forEach(k=>{const el=$('sec'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=!!c[k]});$('autoWelcome').value=c.welcome||'';$('autoMemberLog').value=c.logChannels.member||'';$('autoModLog').value=c.logChannels.mod||'';$('autoServerLog').value=c.logChannels.server||''}catch(e){console.warn(e.message)}}
  $('securityForm').onsubmit=e=>{e.preventDefault();const p={};['antilink','antiinvite','antispam','antimention','antiraid','antibot'].forEach(k=>p[k]=$('sec'+k.charAt(0).toUpperCase()+k.slice(1)).checked);postFeature('/api/settings',p,'securityStatus')};
  $('automationForm').onsubmit=e=>{e.preventDefault();postFeature('/api/settings',{welcome:$('autoWelcome').value,memberLog:$('autoMemberLog').value,modLog:$('autoModLog').value,serverLog:$('autoServerLog').value,antilink:$('secAntilink').checked,antiinvite:$('secAntiinvite').checked,antispam:$('secAntispam').checked,antimention:$('secAntimention').checked,antiraid:$('secAntiraid').checked,antibot:$('secAntibot').checked},'automationStatus')};
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

      if(req.method==="POST"&&url.pathname==="/api/moderation"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null), me=g.members.me;
        if(!actor||!actor.permissions.has("Administrator"))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        const uid=String(b.userId||""), action=String(b.action||""), reason=String(b.reason||"از پنل مدیریت").slice(0,400);
        if(!/^\d{17,20}$/.test(uid))return send(res,400,{error:"شناسه کاربر معتبر نیست."});
        try{
          if(action==="unban"){if(!me.permissions.has("BanMembers"))return send(res,403,{error:"ربات مجوز Unban ندارد."});await g.bans.remove(uid,reason);return send(res,200,{message:"Ban کاربر برداشته شد."})}
          const m=await g.members.fetch(uid).catch(()=>null);if(!m)return send(res,404,{error:"عضو پیدا نشد."});
          if(m.id===s.user.id||m.id===client.user.id)return send(res,400,{error:"این اقدام روی خودت یا ربات مجاز نیست."});
          if(m.roles.highest.position>=actor.roles.highest.position&&!actor.permissions.has("Administrator"))return send(res,403,{error:"نقش عضو بالاتر یا هم‌سطح است."});
          if(action==="timeout"){if(!me.permissions.has("ModerateMembers"))return send(res,403,{error:"ربات مجوز Timeout ندارد."});await m.timeout(Math.max(1,Math.min(40320,Number(b.minutes)||10))*60000,reason);return send(res,200,{message:"Timeout اعمال شد."})}
          if(action==="kick"){if(!me.permissions.has("KickMembers"))return send(res,403,{error:"ربات مجوز Kick ندارد."});await m.kick(reason);return send(res,200,{message:"عضو اخراج شد."})}
          if(action==="ban"){if(!me.permissions.has("BanMembers"))return send(res,403,{error:"ربات مجوز Ban ندارد."});await m.ban({reason});return send(res,200,{message:"عضو Ban شد."})}
          return send(res,400,{error:"اقدام ناشناخته است."})
        }catch(e){console.error("[dashboard] moderation:",e.message);return send(res,500,{error:"اقدام ناموفق بود؛ مجوزها و ترتیب نقش‌ها را بررسی کن."})}
      }
      if(req.method==="POST"&&url.pathname==="/api/embed"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),ch=g.channels.cache.get(String(b.channelId||""));
        if(!actor||!actor.permissions.has("Administrator"))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        if(!ch||![0,5].includes(ch.type)||!ch.isTextBased())return send(res,400,{error:"کانال مقصد معتبر نیست."});
        if(!ch.permissionsFor(g.members.me)?.has("SendMessages")||!ch.permissionsFor(g.members.me)?.has("EmbedLinks"))return send(res,403,{error:"بات به مجوز Send Messages و Embed Links نیاز دارد."});
        const description=String(b.description||"").trim().slice(0,4000),title=String(b.title||"").trim().slice(0,256),footer=String(b.footer||"").trim().slice(0,2048),hex=String(b.color||"45e0a0").replace(/^#/,"");
        if(!description)return send(res,400,{error:"توضیحات الزامی است."});if(!/^[0-9a-fA-F]{6}$/.test(hex))return send(res,400,{error:"رنگ HEX نامعتبر است."});
        const {EmbedBuilder}=require("discord.js"),embed=new EmbedBuilder().setDescription(description).setColor(parseInt(hex,16)).setTimestamp();
        if(title)embed.setTitle(title);if(footer)embed.setFooter({text:footer});
        try{await ch.send({embeds:[embed],allowedMentions:{parse:[]}});return send(res,200,{message:"Embed با موفقیت ارسال شد."})}catch{return send(res,500,{error:"ارسال Embed ناموفق بود."})}
      }
      if(req.method==="POST"&&url.pathname==="/api/community-panel"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),ch=g.channels.cache.get(String(b.channelId||""));
        if(!actor||!actor.permissions.has("Administrator"))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        if(!ch||![0,5].includes(ch.type)||!ch.isTextBased())return send(res,400,{error:"کانال مقصد معتبر نیست."});
        if(!ch.permissionsFor(g.members.me)?.has("SendMessages")||!ch.permissionsFor(g.members.me)?.has("EmbedLinks"))return send(res,403,{error:"بات به مجوز ارسال پیام و Embed نیاز دارد."});
        const title=String(b.title||"").trim().slice(0,256),description=String(b.description||"").trim().slice(0,3500),kind=String(b.kind||"ticket");
        if(!title||!description)return send(res,400,{error:"عنوان و توضیحات الزامی است."});
        const {EmbedBuilder}=require("discord.js");
        const note=kind==="ticket"?"برای باز کردن تیکت، از دستور /ticket موجود بات استفاده کن.":"این پیام راهنمای انتخاب نقش است؛ اعطای خودکار نقش هنوز از این پنل فعال نشده است.";
        const embed=new EmbedBuilder().setTitle(title).setDescription(description+"\n\n"+note).setColor(0x45e0a0).setTimestamp();
        try{await ch.send({embeds:[embed],allowedMentions:{parse:[]}});return send(res,200,{message:kind==="ticket"?"پنل راهنمای تیکت ارسال شد.":"پنل راهنمای نقش ارسال شد؛ برای اعطای خودکار نقش باید منطق دکمه‌ها به بات متصل شود."})}catch{return send(res,500,{error:"ارسال پنل ناموفق بود."})}
      }


      if(req.method==="GET"&&url.pathname==="/api/settings"){
        const g=client.guilds.cache.get(String(url.searchParams.get("guildId")||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"دسترسی به سرور مجاز نیست."});
        const api=global.__botDashboardApi, cfg=api?.getSettings(g.id);
        if(!cfg)return send(res,503,{error:"تنظیمات بات هنوز آماده نیست."});
        return send(res,200,{antilink:!!cfg.antilink,antiinvite:!!cfg.antiinvite,antispam:!!cfg.antispam,antimention:!!cfg.antimention,antiraid:!!cfg.antiraid,antibot:!!cfg.antibot,welcome:cfg.welcome||"",logChannels:cfg.logChannels||{member:null,mod:null,server:null}});
      }
      if(req.method==="POST"&&url.pathname==="/api/settings"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"دسترسی به سرور مجاز نیست."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null);
        if(!actor||!actor.permissions.has("Administrator"))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        const api=global.__botDashboardApi,cfg=api?.getSettings(g.id);
        if(!cfg)return send(res,503,{error:"تنظیمات بات هنوز آماده نیست."});
        for(const k of ["antilink","antiinvite","antispam","antimention","antiraid","antibot"])cfg[k]=!!b[k];
        const channelIds=[b.welcome,b.memberLog,b.modLog,b.serverLog].filter(Boolean).map(String);
        if(channelIds.some(id=>!g.channels.cache.has(id)))return send(res,400,{error:"یکی از کانال‌ها معتبر نیست."});
        cfg.welcome=String(b.welcome||"")||null;
        cfg.logChannels={member:String(b.memberLog||"")||null,mod:String(b.modLog||"")||null,server:String(b.serverLog||"")||null};
        cfg.logs=cfg.logChannels.mod;
        await api.saveGuildSettings(g.id);
        return send(res,200,{message:"تنظیمات امنیت و اتوماسیون ذخیره شد."});
      }

      return send(res,404,{error:"مسیر پیدا نشد."});
    }
    res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
  });
  server.on("error",e=>console.error("[dashboard] Server error:",e));
  server.listen(PORT,"0.0.0.0",()=>console.log("[dashboard] Listening on port "+PORT));
}
module.exports={attachDashboard};
