const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;
const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;

function attachDashboard(client) {
  const sessions = client.__dashboardSessions || (client.__dashboardSessions = new Map());
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bot Control Center</title><style>
  :root{color-scheme:dark;--bg:#090d12;--panel:#111923;--panel2:#172330;--line:#263746;--green:#45e0a0;--muted:#9db0c0;--text:#edf6f7;--red:#ff697a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 90% 0,#12372f 0,transparent 35%),var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer;border:0;border-radius:12px;padding:12px 16px;background:var(--green);color:#062017;font-weight:800}button:disabled{opacity:.5;cursor:not-allowed}.shell{max-width:1180px;margin:auto;padding:22px}.top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:12px}.logo{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--green);color:#062017;font-weight:1000;font-size:21px}.muted{color:var(--muted)}.layout{display:grid;grid-template-columns:240px 1fr;gap:18px;margin-top:26px}.side,.panel,.stat{background:linear-gradient(145deg,#121c26,#0e151d);border:1px solid var(--line);border-radius:20px}.side{padding:16px;height:max-content}.nav{display:block;text-align:right;width:100%;background:transparent;color:var(--muted);margin:5px 0}.nav.active,.nav:hover{background:var(--panel2);color:var(--green)}.content{min-width:0}.hero{padding:24px;margin-bottom:16px}.panel{padding:20px;margin-bottom:16px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.stat{padding:18px}.num{font-size:27px;font-weight:900;color:var(--green);margin-top:8px}label{display:block;font-weight:750;margin:12px 0 7px}input,select,textarea{width:100%;padding:12px;border-radius:11px;border:1px solid var(--line);background:#091119;color:var(--text);outline:none}input:focus,select:focus,textarea:focus{border-color:var(--green)}textarea{min-height:125px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.status{padding:10px 13px;border-radius:10px;background:#14261f;color:var(--green);margin-top:12px;white-space:pre-wrap}.hidden{display:none!important}.login{max-width:540px;margin:12vh auto;text-align:center;padding:32px}.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 10px;color:var(--muted);font-size:12px}.sectionTitle{display:flex;justify-content:space-between;gap:10px;align-items:center}.small{font-size:13px}.danger{background:#4a2029;color:#ffdce1}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.empty{padding:26px;text-align:center;color:var(--muted)} .log-list{display:grid;gap:10px}.log-row{display:grid;grid-template-columns:170px 85px minmax(0,1fr);gap:12px;align-items:start;padding:13px;border:1px solid var(--line);border-radius:13px;background:#0b131b}.log-time{font-size:12px;color:var(--muted);direction:ltr;text-align:left}.log-level{font-size:11px;font-weight:900;border-radius:7px;padding:5px 8px;text-align:center;background:#1b2935;color:var(--muted)}.log-level.error{background:#421f28;color:#ff9aa7}.log-level.warn{background:#40341b;color:#ffd37b}.log-level.info{background:#14352a;color:#7df0bb}.log-message{overflow-wrap:anywhere;white-space:pre-wrap;font-size:13px}.log-tools{display:grid;grid-template-columns:1fr 180px auto;gap:10px;align-items:center}@media(max-width:760px){.log-row{grid-template-columns:1fr;gap:6px}.log-time{text-align:right}.log-tools{grid-template-columns:1fr}}@media(max-width:760px){.layout{grid-template-columns:1fr}.side{display:flex;overflow:auto;gap:6px}.nav{white-space:nowrap;text-align:center;width:auto}.stats{grid-template-columns:1fr}.row,.cards{grid-template-columns:1fr}.shell{padding:12px}}
  </style></head><body><div class="shell"><header class="top"><div class="brand"><div class="logo">B</div><div><strong>Bot Control Center</strong><div class="muted small">پنل مدیریت سرورهای دیسکورد</div></div></div><div id="userArea" class="muted small"></div></header>
  <section id="login" class="panel login"><div class="logo" style="margin:0 auto 18px">B</div><h1>همه‌چیز زیر کنترل توئه.</h1><p class="muted">با دیسکورد وارد شو، سرور رو انتخاب کن و ابزارهای ربات رو از یک پنل مدیریت کن.</p><a id="loginBtn" href="/auth/discord" style="display:inline-block;text-decoration:none;border:0;border-radius:12px;padding:12px 16px;background:var(--green);color:#062017;font-weight:800">ورود با Discord</a><p class="muted small">فقط سرورهایی نمایش داده می‌شن که دسترسی مدیریتی داری و ربات داخلشونه.</p></section>
  <div id="app" class="layout hidden"><aside class="side"><label for="guildSelect">سرور فعال</label><select id="guildSelect"></select><div style="height:14px"></div><button class="nav active" data-page="overview">◈ نمای کلی</button><button class="nav" data-page="hidem">✦ ارسال پیام Hidem</button><button class="nav" data-page="tools">⚡ ابزارها</button><button class="nav" data-page="members">🛡️ اعضا</button><button class="nav" data-page="roles">🏷️ مدیریت رول‌ها</button><button class="nav" data-page="channels">➕ ساخت چنل</button><button class="nav" data-page="embed">✉️ Embed</button><button class="nav" data-page="community">🎫 تیکت و نقش</button><button class="nav" data-page="advanced">🚀 ابزارهای بیشتر</button><button class="nav" data-page="security">◉ امنیت</button><button class="nav" data-page="clash">🏆 Community Clash</button><button class="nav hidden" id="logsNav" data-page="logs">📜 لاگ‌های سیستم</button><button class="nav hidden" id="leaveGuildNav" data-page="leaveGuild">🚪 خروج بات از سرور</button><div style="height:14px"></div><button class="nav" id="logoutBtn">خروج</button></aside><main class="content">
  <section id="logsPage" class="hidden"><div class="panel"><div class="sectionTitle"><div><h1>📜 لاگ‌های سیستم</h1><p class="muted small">رویدادهای بات و پنل، خطاها و درخواست‌های مدیریتی اخیر. لاگ‌های این صفحه در حافظه نگه‌داری می‌شوند و با Restart پاک می‌شوند.</p></div><button id="refreshLogsBtn" type="button">↻ تازه‌سازی</button></div><div class="log-tools"><input id="logSearch" placeholder="جست‌وجو در متن لاگ..."><select id="logLevel"><option value="all">همه سطح‌ها</option><option value="error">خطاها</option><option value="warn">هشدارها</option><option value="info">اطلاعات</option><option value="debug">Debug</option></select><span id="logCount" class="pill">۰ رویداد</span></div><div id="logList" class="log-list" style="margin-top:14px"><div class="empty">برای دریافت لاگ‌ها روی تازه‌سازی بزن.</div></div></div></section><section id="leaveGuildPage" class="hidden"><div class="panel"><h1>🚪 خروج بات از سرور</h1><p class="muted">سرور موردنظر را از فهرست سمت چپ انتخاب کن. این قابلیت فقط برای Owner پنل فعال است و بات بعد از تأیید از همان سرور خارج می‌شود.</p><div class="stat"><div class="muted">سرور انتخاب‌شده</div><strong id="leaveGuildName">—</strong><p class="muted small" id="leaveGuildId"></p></div><button id="leaveGuildBtn" class="danger" type="button" style="margin-top:14px">خروج بات از این سرور</button><div id="leaveGuildStatus" class="status hidden"></div></div></section><section id="overviewPage"><div class="panel hero"><span class="pill">CONTROL CENTER / LIVE</span><h1 id="guildTitle">داشبورد سرور</h1><p class="muted">نمای کلی و ابزارهای مدیریتی ربات در یک جا.</p></div><div class="stats"><div class="stat"><div class="muted">اعضا</div><div class="num" id="members">—</div></div><div class="stat"><div class="muted">کانال‌ها</div><div class="num" id="channels">—</div></div><div class="stat"><div class="muted">نقش‌ها</div><div class="num" id="roles">—</div></div></div><div class="panel"><div class="sectionTitle"><h2>میانبرها</h2><span class="pill">ADMIN</span></div><div class="cards"><button data-goto="hidem">ارسال پیام با Hidem</button><button data-goto="tools">مشاهده ابزارها</button></div></div></section>
  <section id="hidemPage" class="hidden"><div class="panel"><h1>✦ Hidem Message</h1><p class="muted">پیام را با هویت خود ربات در کانال انتخاب‌شده ارسال کن.</p><form id="hidemForm"><label>کانال مقصد</label><select id="channelSelect" required></select><label>متن پیام</label><textarea id="hidemMessage" maxlength="2000" required placeholder="پیام خودت رو اینجا بنویس..."></textarea><div style="margin-top:14px"><button style="width:100%" type="submit">ارسال پیام ↗</button></div><div id="hidemStatus" class="status hidden"></div></form></div></section>
  <section id="toolsPage" class="hidden"><div class="panel"><h1>⚡ ابزارهای مدیریتی</h1><p class="muted">این بخش برای اضافه‌شدن کنترل‌های وبی امکانات ربات آماده شده.</p><div class="cards"><div class="stat"><strong>مدیریت پیام</strong><p class="muted small">ارسال پیام با Hidem از طریق پنل.</p><button data-goto="hidem">باز کردن</button></div><div class="stat"><strong>Trial Moderator</strong><p class="muted small">پنل درخواست‌های TMPS و بررسی وضعیت.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>مدیریت اعضا</strong><p class="muted small">ابزارهای مدیریت اعضا و نقش‌ها.</p><span class="pill">در مرحله بعد</span></div><div class="stat"><strong>لاگ و آمار</strong><p class="muted small">آمار سرور و فعالیت‌های ربات.</p><span class="pill">در مرحله بعد</span></div></div></div></section>
  <section id="membersPage" class="hidden"><div class="panel"><h1>🛡️ مدیریت اعضا</h1><p class="muted">شناسه کاربر را وارد کن. عملیات حساس قبل از اجرا تأیید می‌خواهد.</p><form id="modForm"><label>شناسه کاربر</label><input id="modUser" inputmode="numeric" pattern="[0-9]{17,20}" required placeholder="Discord User ID"><label>دلیل</label><input id="modReason" maxlength="400" placeholder="دلیل اقدام"><div class="row"><div><label>اقدام</label><select id="modAction"><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option><option value="unban">Unban</option></select></div><div><label>مدت Timeout (دقیقه)</label><input id="modMinutes" type="number" min="1" max="40320" value="10"></div></div><button style="margin-top:14px" type="submit">اجرای اقدام</button><div id="modStatus" class="status hidden"></div></form></div></section>
<section id="channelsPage" class="hidden"><div class="panel"><h1>➕ ساخت چنل جدید</h1><p class="muted">برای سرور انتخاب‌شده کانال متنی یا ویس بساز. بات باید مجوز Manage Channels داشته باشد.</p><form id="createChannelForm"><label>نام چنل</label><input id="newChannelName" maxlength="100" required placeholder="مثلاً general یا Gaming Voice"><div class="row"><div><label>نوع چنل</label><select id="newChannelType"><option value="text">متنی</option><option value="voice">ویس</option></select></div><div><label>دسته‌بندی</label><select id="newChannelCategory"><option value="">بدون دسته‌بندی</option></select></div></div><div id="newChannelTopicWrap"><label>موضوع چنل (اختیاری)</label><input id="newChannelTopic" maxlength="1024" placeholder="موضوع یا توضیح کوتاه کانال"></div><button style="margin-top:14px" type="submit">ساخت چنل با بات</button><div id="createChannelStatus" class="status hidden"></div></form></div></section><section id="rolesPage" class="hidden">
<div class="panel"><h1>🏷️ ساخت رول جدید</h1><p class="muted">اسم، رنگ و پرمیشن‌های رول را انتخاب کن. بات فقط در صورت داشتن مجوز Manage Roles و جایگاه مناسب می‌تواند رول بسازد.</p><form id="createRoleForm"><label>نام رول</label><input id="newRoleName" maxlength="100" required placeholder="مثلاً Moderator"><div class="row"><div><label>رنگ رول</label><input id="newRoleColor" type="color" value="#45e0a0" style="height:48px;padding:4px"></div><div><label>نمایش جداگانه در لیست اعضا</label><select id="newRoleHoist"><option value="false">خیر</option><option value="true">بله</option></select></div></div><label>پرمیشن‌ها</label><div class="cards" id="rolePermissionChoices">
<label><input type="checkbox" value="ViewChannel" style="width:auto"> مشاهده کانال‌ها</label><label><input type="checkbox" value="SendMessages" style="width:auto"> ارسال پیام</label><label><input type="checkbox" value="EmbedLinks" style="width:auto"> ارسال Embed</label><label><input type="checkbox" value="AttachFiles" style="width:auto"> پیوست فایل</label><label><input type="checkbox" value="ReadMessageHistory" style="width:auto"> تاریخچه پیام‌ها</label><label><input type="checkbox" value="ManageMessages" style="width:auto"> مدیریت پیام‌ها</label><label><input type="checkbox" value="ManageThreads" style="width:auto"> مدیریت Threadها</label><label><input type="checkbox" value="CreatePublicThreads" style="width:auto"> ساخت Thread عمومی</label><label><input type="checkbox" value="Connect" style="width:auto"> اتصال به ویس</label><label><input type="checkbox" value="Speak" style="width:auto"> صحبت در ویس</label><label><input type="checkbox" value="MuteMembers" style="width:auto"> میوت اعضا</label><label><input type="checkbox" value="MoveMembers" style="width:auto"> جابه‌جایی اعضا در ویس</label><label><input type="checkbox" value="KickMembers" style="width:auto"> اخراج اعضا</label><label><input type="checkbox" value="BanMembers" style="width:auto"> بن اعضا</label><label><input type="checkbox" value="ModerateMembers" style="width:auto"> Timeout اعضا</label><label><input type="checkbox" value="ManageNicknames" style="width:auto"> مدیریت نیک‌نیم</label><label><input type="checkbox" value="ManageRoles" style="width:auto"> مدیریت رول‌ها</label><label><input type="checkbox" value="ManageChannels" style="width:auto"> مدیریت کانال‌ها</label><label><input type="checkbox" value="ManageWebhooks" style="width:auto"> مدیریت Webhook</label><label><input type="checkbox" value="ManageGuild" style="width:auto"> مدیریت سرور</label><label><input type="checkbox" value="Administrator" style="width:auto"> Administrator (دسترسی کامل)</label>
</div><button style="margin-top:14px" type="submit">ساخت رول با بات</button><div id="createRoleStatus" class="status hidden"></div></form></div>
<div class="panel"><h1>👤 دادن یا گرفتن رول</h1><p class="muted">شناسه دیسکورد عضو را وارد کن و رول موردنظر را انتخاب کن.</p><form id="dashboardRoleForm"><label>شناسه عضو</label><input id="dashboardRoleUserId" inputmode="numeric" pattern="[0-9]{17,20}" required placeholder="Discord User ID"><label>رول</label><select id="dashboardRoleSelect" required></select><label>عملیات</label><select id="dashboardRoleAction"><option value="add">دادن رول</option><option value="remove">گرفتن رول</option></select><button style="margin-top:14px" type="submit">اعمال تغییر</button><div id="dashboardRoleStatus" class="status hidden"></div></form></div>
</section>
<section id="embedPage" class="hidden"><div class="panel"><h1>✉️ سازنده Embed</h1><form id="embedForm"><label>کانال مقصد</label><select id="embedChannel" required></select><label>عنوان</label><input id="embedTitle" maxlength="256"><label>توضیحات</label><textarea id="embedDescription" maxlength="4000" required></textarea><div class="row"><div><label>رنگ HEX</label><input id="embedColor" value="#45e0a0" pattern="#?[0-9a-fA-F]{6}"></div><div><label>Footer</label><input id="embedFooter" maxlength="2048"></div></div><button style="margin-top:14px" type="submit">ارسال Embed</button><div id="embedStatus" class="status hidden"></div></form></div></section>
<section id="communityPage" class="hidden"><div class="panel"><h1>🎫 پنل راهنمای تیکت</h1><form id="ticketForm"><label>کانال مقصد</label><select id="ticketChannel" required></select><label>عنوان</label><input id="ticketTitle" maxlength="256" value="مرکز پشتیبانی"><label>توضیحات</label><textarea id="ticketText" maxlength="3500" required>برای دریافت پشتیبانی از دستور /ticket استفاده کن.</textarea><button type="submit">ارسال پنل تیکت</button><div id="ticketStatus" class="status hidden"></div></form></div><div class="panel"><h1>🏷️ پنل راهنمای Self-Role</h1><form id="roleForm"><label>کانال مقصد</label><select id="roleChannel" required></select><label>عنوان</label><input id="roleTitle" maxlength="256" value="انتخاب نقش"><label>توضیحات</label><textarea id="roleText" maxlength="3500" required>برای دریافت نقش موردنظر با مدیر سرور هماهنگ کن.</textarea><button type="submit">ارسال پنل نقش</button><div id="roleStatus" class="status hidden"></div></form><p class="muted small">این نسخه پیام راهنما می‌سازد؛ اعطای خودکار نقش از طریق دکمه هنوز فعال نشده.</p></div></section>
<section id="advancedPage" class="hidden">
<div class="panel"><h1>📣 ارسال اعلان</h1><p class="muted">اعلان را در کانال دلخواه بفرست؛ منشن‌ها به‌صورت پیش‌فرض اجرا نمی‌شوند.</p><form id="announceForm"><label>کانال</label><select id="announceChannel" required></select><label>متن اعلان</label><textarea id="announceText" maxlength="2000" required placeholder="متن اطلاعیه..."></textarea><label>نوع اعلان</label><select id="announceKind"><option value="plain">پیام معمولی</option><option value="embed">Embed سبز</option></select><button type="submit">ارسال اعلان</button><div id="announceStatus" class="status hidden"></div></form></div>
<div class="panel"><h1>🧹 پاک‌سازی پیام‌ها</h1><p class="muted">تعداد پیام‌هایی که می‌خواهی از کانال انتخابی پاک کنی (حداکثر 100 پیام اخیر؛ پیام‌های قدیمی‌تر از ۱۴ روز پاک نمی‌شوند).</p><form id="purgeForm"><label>کانال</label><select id="purgeChannel" required></select><label>تعداد پیام (۱ تا ۱۰۰)</label><input id="purgeCount" type="number" min="1" max="100" value="10" required><button class="danger" type="submit">پاک‌سازی پیام‌ها</button><div id="purgeStatus" class="status hidden"></div></form></div>
<div class="panel"><h1>📊 ساخت نظرسنجی</h1><form id="pollForm"><label>کانال</label><select id="pollChannel" required></select><label>سؤال نظرسنجی</label><input id="pollQuestion" maxlength="250" required placeholder="سؤال..."><label>گزینه‌ها (هر گزینه در یک خط، ۲ تا ۱۰ گزینه)</label><textarea id="pollOptions" required placeholder="گزینه اول&#10;گزینه دوم"></textarea><button type="submit">ساخت نظرسنجی</button><div id="pollStatus" class="status hidden"></div></form></div>
<div class="panel"><h1>🏷️ مدیریت نقش عضو</h1><form id="memberRoleForm"><label>شناسه عضو</label><input id="roleMemberId" inputmode="numeric" pattern="[0-9]{17,20}" required placeholder="Discord User ID"><label>نقش</label><select id="memberRoleId" required></select><label>عملیات</label><select id="memberRoleAction"><option value="add">دادن نقش</option><option value="remove">گرفتن نقش</option></select><button type="submit">اجرای تغییر نقش</button><div id="memberRoleStatus" class="status hidden"></div></form></div>
</section>
<section id="securityPage" class="hidden"><div class="panel"><h1>🛡️ تنظیمات امنیتی</h1><p class="muted">فیلترهای امنیتی موجود بات را برای سرور فعال یا غیرفعال کن.</p><form id="securityForm"><label><input type="checkbox" id="secAntilink" style="width:auto"> حذف لینک‌ها</label><label><input type="checkbox" id="secAntiinvite" style="width:auto"> حذف دعوت‌نامه‌ها</label><label><input type="checkbox" id="secAntispam" style="width:auto"> ضداسپم</label><label><input type="checkbox" id="secAntimention" style="width:auto"> ضدمنشن انبوه</label><label><input type="checkbox" id="secAntiraid" style="width:auto"> هشدار Anti-Raid</label><label><input type="checkbox" id="secAntibot" style="width:auto"> جلوگیری از ورود بات‌ها</label><button type="submit">ذخیره امنیت</button><div id="securityStatus" class="status hidden"></div></form></div><div class="panel"><h2>⚙️ اتوماسیون</h2><form id="automationForm"><label>کانال خوشامدگویی</label><select id="autoWelcome"></select><label>لاگ اعضا</label><select id="autoMemberLog"></select><label>لاگ مدیریت</label><select id="autoModLog"></select><label>لاگ سرور</label><select id="autoServerLog"></select><button type="submit">ذخیره اتوماسیون</button><div id="automationStatus" class="status hidden"></div></form></div></section>
<section id="clashPage" class="hidden"><div class="panel hero"><span class="pill">COMMUNITY EVENT ENGINE</span><h1>🏆 Community Clash</h1><p class="muted">ایونت را از همین پنل بساز؛ بات خودش چنل‌ها، رول‌های جایزه و پیام‌ها را ایجاد می‌کند.</p></div><div class="panel"><h2>ساخت ایونت</h2><form id="clashCreateForm"><label>نام ایونت</label><input id="clashTitle" maxlength="100" required value="Community Clash"><label>توضیحات</label><textarea id="clashDescription" maxlength="1500" required>سه روز رقابت دوستانه برای فعال‌تر شدن جامعه سرور!</textarea><div class="row"><div><label>زمان پایان</label><input id="clashEndAt" type="datetime-local" required></div><div><label>تعداد برنده‌ها</label><select id="clashWinners"><option value="1">۱</option><option value="2">۲</option><option value="3" selected>۳</option></select></div></div><div class="row"><div><label>مدت رول جایزه (روز)</label><input id="clashRoleDays" type="number" min="1" max="90" value="30" required></div><div><label>سؤال چالش</label><input id="clashQuestion" maxlength="1000" required value="اگر می‌توانستی یک قابلیت به Discord اضافه کنی، چه بود و چرا؟"></div></div><label>مأموریت جامعه</label><textarea id="clashMission" maxlength="1000" required>سه پیشنهاد کاربردی و متفاوت برای بهتر شدن سرور ثبت کن.</textarea><button type="submit">ساخت خودکار منابع</button><div id="clashCreateStatus" class="status hidden"></div></form></div><div class="panel"><div class="sectionTitle"><h2>کنترل ایونت</h2><button type="button" id="clashRefresh" class="nav">↻ بروزرسانی</button></div><div id="clashOverview" class="empty">هنوز ایونتی بارگذاری نشده.</div><div class="cards"><button type="button" id="clashStart">▶ شروع</button><button type="button" id="clashPause">⏸ توقف</button><button type="button" id="clashResume">↻ ادامه</button><button type="button" id="clashEnd" class="danger">■ بستن ارسال‌ها و محاسبه نتایج</button><button type="button" id="clashConfirm">✅ تأیید برندگان و اعلام</button><button type="button" id="clashCancel" class="danger">لغو ایونت</button><button type="button" id="clashReport">📄 ساخت گزارش</button><button type="button" id="clashStageChallenge">🧠 فعال‌سازی Challenge</button><button type="button" id="clashStageMeme">😂 فعال‌سازی Meme Battle</button><button type="button" id="clashStageMission">🤝 فعال‌سازی Mission</button></div><div id="clashActionStatus" class="status hidden"></div></div><div class="panel"><h2>📥 ارسال‌ها برای بررسی</h2><div id="clashSubmissions" class="empty">ارسالی وجود ندارد.</div></div><div class="panel"><h2>🏆 جدول امتیازها</h2><div id="clashLeaderboard" class="empty">هنوز امتیازی ثبت نشده.</div></div><div class="panel"><h2>🧾 گزارش فعالیت</h2><div id="clashAudit" class="empty">رویدادی ثبت نشده.</div><label for="clashReportText">گزارش قابل کپی</label><textarea id="clashReportText" rows="10" readonly placeholder="برای ساخت گزارش، دکمه «ساخت گزارش» را بزن."></textarea><button type="button" id="clashCopyReport">کپی گزارش</button></div></section>
    </main></div></div><script>window.addEventListener('error',function(e){var n=document.getElementById('userArea');if(n)n.textContent='خطای پنل: '+e.message;});</script><script>
  const $=id=>document.getElementById(id);let guilds=[],activeGuild=null,csrf='';
  async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({error:'پاسخ نامعتبر سرور'}));if(!r.ok)throw new Error(d.error||'درخواست ناموفق بود');return d}
  function showPage(name){['overview','hidem','tools','members','roles','channels','embed','community','advanced','security','clash','leaveGuild','logs'].forEach(p=>$(p+'Page').classList.toggle('hidden',p!==name));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name))}
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
  async function loadGuild(){activeGuild=$('guildSelect').value;const g=guilds.find(x=>x.id===activeGuild);if(!g)return;$('guildTitle').textContent=g.name;const leaveName=$('leaveGuildName');if(leaveName)leaveName.textContent=g.name;const leaveId=$('leaveGuildId');if(leaveId)leaveId.textContent=g.id;const d=await api('/api/guild/'+activeGuild);$('members').textContent=d.memberCount??'—';$('channels').textContent=d.channels.length;$('roles').textContent=d.roles.length;const categoryEl=$('newChannelCategory');if(categoryEl)categoryEl.innerHTML='<option value="">بدون دسته‌بندی</option>'+(d.categories||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');$('channelSelect').innerHTML=d.channels.map(c=>'<option value="'+c.id+'"># '+esc(c.name)+'</option>').join('');['embedChannel','ticketChannel','roleChannel','autoWelcome','autoMemberLog','autoModLog','autoServerLog','announceChannel','purgeChannel','pollChannel'].forEach(id=>{const el=$(id);if(el)el.innerHTML=d.channels.map(c=>'<option value="'+c.id+'"># '+esc(c.name)+'</option>').join('')});const roleOptions=d.roles.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');const roleEl=$('memberRoleId');if(roleEl)roleEl.innerHTML=roleOptions;const dashRoleEl=$('dashboardRoleSelect');if(dashRoleEl)dashRoleEl.innerHTML=roleOptions;await loadSettings();await loadClash()}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function init(){try{const d=await api('/api/me');if(!d.user){$('login').classList.remove('hidden');return}csrf=d.csrf;$('login').classList.add('hidden');$('app').classList.remove('hidden');$('userArea').textContent=d.user.username+' • Discord';$('leaveGuildNav').classList.toggle('hidden',!d.isPanelOwner);$('logsNav').classList.toggle('hidden',!d.isPanelOwner);guilds=await api('/api/guilds');$('guildSelect').innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');if(!guilds.length){$('guildTitle').textContent='سرور مدیریتی پیدا نشد';return}await loadGuild()}catch(e){$('login').classList.remove('hidden');$('userArea').textContent=e.message}}
  let cachedOpsLogs=[];
  function renderLogs(){
    const query=$('logSearch').value.trim().toLowerCase(),level=$('logLevel').value;
    const filtered=cachedOpsLogs.filter(x=>(level==='all'||x.level===level)&&(!query||(x.message+' '+x.source).toLowerCase().includes(query)));
    $('logCount').textContent=filtered.length+' رویداد';
    $('logList').innerHTML=filtered.length?filtered.slice().reverse().map(x=>'<div class="log-row"><div class="log-time">'+esc(new Date(x.timestamp).toLocaleString())+'</div><div class="log-level '+esc(x.level)+'">'+esc(x.level.toUpperCase())+' · '+esc(x.source)+'</div><div class="log-message">'+esc(x.message)+'</div></div>').join(''):'<div class="empty">لاگی با این فیلتر پیدا نشد.</div>';
  }
  async function loadOpsLogs(){const list=$('logList');list.innerHTML='<div class="empty">در حال دریافت لاگ‌ها...</div>';try{const d=await api('/api/logs');cachedOpsLogs=d.logs||[];renderLogs()}catch(e){list.innerHTML='<div class="empty">دریافت لاگ‌ها ناموفق بود: '+esc(e.message)+'</div>'}}
  $('refreshLogsBtn').onclick=loadOpsLogs;$('logSearch').oninput=renderLogs;$('logLevel').onchange=renderLogs;
  setInterval(()=>{if(!$('logsPage').classList.contains('hidden'))loadOpsLogs()},10000);
  $('leaveGuildBtn').onclick=async()=>{const g=guilds.find(x=>x.id===$('guildSelect').value);if(!g)return;if(!confirm('مطمئنی بات از سرور «'+g.name+'» خارج شود؟ برای برگشت باید دوباره بات را به سرور دعوت کنی.'))return;const btn=$('leaveGuildBtn');btn.disabled=true;try{const result=await api('/api/leave-guild',{method:'POST',body:JSON.stringify({csrf,guildId:g.id})});$('leaveGuildStatus').classList.remove('hidden');$('leaveGuildStatus').textContent=result.message;guilds=await api('/api/guilds');$('guildSelect').innerHTML=guilds.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');if(guilds.length){await loadGuild()}else{$('guildTitle').textContent='بات در هیچ سروری نیست';$('leaveGuildName').textContent='—';$('leaveGuildId').textContent='';}showPage('leaveGuild');}catch(e){$('leaveGuildStatus').classList.remove('hidden');$('leaveGuildStatus').textContent='خطا: '+e.message;}finally{btn.disabled=false;}};
  $('logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST',body:JSON.stringify({csrf})});location.reload()};$('guildSelect').onchange=()=>loadGuild().catch(e=>alert(e.message));
  $('hidemForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const st=$('hidemStatus');st.classList.remove('hidden');st.textContent='در حال ارسال...';try{const d=await api('/api/hidem',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,channelId:$('channelSelect').value,message:$('hidemMessage').value,})});st.textContent=d.message;$('hidemMessage').value='';$('hidemPassword').value=''}catch(err){st.textContent='خطا: '+err.message}finally{b.disabled=false}};

  async function postFeature(path,payload,statusId,confirmText){if(confirmText&&!confirm(confirmText))return;const st=$(statusId);st.classList.remove('hidden');st.textContent='در حال اجرا...';try{const d=await api(path,{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,...payload})});st.textContent=d.message||'انجام شد.'}catch(e){st.textContent='خطا: '+e.message}}
  $('createChannelForm').onsubmit=e=>{e.preventDefault();postFeature('/api/channels/create',{name:$('newChannelName').value.trim(),type:$('newChannelType').value,categoryId:$('newChannelCategory').value,topic:$('newChannelTopic').value.trim()},'createChannelStatus','چنل با این مشخصات در سرور فعلی ساخته شود؟').then(()=>loadGuild().catch(()=>{}));};
  $('createRoleForm').onsubmit=e=>{e.preventDefault();const permissions=[...document.querySelectorAll('#rolePermissionChoices input:checked')].map(x=>x.value);postFeature('/api/roles/create',{name:$('newRoleName').value.trim(),color:$('newRoleColor').value,hoist:$('newRoleHoist').value==='true',permissions},'createRoleStatus','رول با این پرمیشن‌ها ساخته شود؟ اگر Administrator انتخاب شده باشد، رول دسترسی کامل خواهد داشت.').then(()=>loadGuild().catch(()=>{}));};
  $('dashboardRoleForm').onsubmit=e=>{e.preventDefault();postFeature('/api/roles/assign',{userId:$('dashboardRoleUserId').value.trim(),roleId:$('dashboardRoleSelect').value,action:$('dashboardRoleAction').value},'dashboardRoleStatus','از تغییر رول این عضو مطمئنی؟')};
  $('modForm').onsubmit=e=>{e.preventDefault();postFeature('/api/moderation',{userId:$('modUser').value.trim(),reason:$('modReason').value,action:$('modAction').value,minutes:Number($('modMinutes').value)},'modStatus','از اجرای این اقدام مطمئنی؟')};
  $('embedForm').onsubmit=e=>{e.preventDefault();postFeature('/api/embed',{channelId:$('embedChannel').value,title:$('embedTitle').value,description:$('embedDescription').value,color:$('embedColor').value,footer:$('embedFooter').value},'embedStatus')};
  $('ticketForm').onsubmit=e=>{e.preventDefault();postFeature('/api/community-panel',{kind:'ticket',channelId:$('ticketChannel').value,title:$('ticketTitle').value,description:$('ticketText').value},'ticketStatus')};
  $('roleForm').onsubmit=e=>{e.preventDefault();postFeature('/api/community-panel',{kind:'role',channelId:$('roleChannel').value,title:$('roleTitle').value,description:$('roleText').value},'roleStatus')};

  async function loadSettings(){if(!activeGuild)return;try{const c=await api('/api/settings?guildId='+activeGuild);['antilink','antiinvite','antispam','antimention','antiraid','antibot'].forEach(k=>{const el=$('sec'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=!!c[k]});$('autoWelcome').value=c.welcome||'';$('autoMemberLog').value=c.logChannels.member||'';$('autoModLog').value=c.logChannels.mod||'';$('autoServerLog').value=c.logChannels.server||''}catch(e){console.warn(e.message)}}
  $('securityForm').onsubmit=e=>{e.preventDefault();const p={};['antilink','antiinvite','antispam','antimention','antiraid','antibot'].forEach(k=>p[k]=$('sec'+k.charAt(0).toUpperCase()+k.slice(1)).checked);postFeature('/api/settings',p,'securityStatus')};
  $('automationForm').onsubmit=e=>{e.preventDefault();postFeature('/api/settings',{welcome:$('autoWelcome').value,memberLog:$('autoMemberLog').value,modLog:$('autoModLog').value,serverLog:$('autoServerLog').value,antilink:$('secAntilink').checked,antiinvite:$('secAntiinvite').checked,antispam:$('secAntispam').checked,antimention:$('secAntimention').checked,antiraid:$('secAntiraid').checked,antibot:$('secAntibot').checked},'automationStatus')};

  $('announceForm').onsubmit=e=>{e.preventDefault();postFeature('/api/announce',{channelId:$('announceChannel').value,message:$('announceText').value,kind:$('announceKind').value},'announceStatus')};
  $('purgeForm').onsubmit=e=>{e.preventDefault();postFeature('/api/purge',{channelId:$('purgeChannel').value,count:Number($('purgeCount').value)},'purgeStatus','این کار پیام‌های اخیر کانال را برای همه حذف می‌کند. ادامه می‌دهی؟')};
  $('pollForm').onsubmit=e=>{e.preventDefault();postFeature('/api/poll',{channelId:$('pollChannel').value,question:$('pollQuestion').value,options:$('pollOptions').value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean)},'pollStatus')};
  $('memberRoleForm').onsubmit=e=>{e.preventDefault();postFeature('/api/member-role',{userId:$('roleMemberId').value.trim(),roleId:$('memberRoleId').value,action:$('memberRoleAction').value},'memberRoleStatus','تغییر نقش این عضو را تأیید می‌کنی؟')};
  let clashEvent=null;
  function clashStatus(id,text){const el=$(id);el.classList.remove('hidden');el.textContent=text}
  async function loadClash(){if(!activeGuild)return;try{const d=await api('/api/community-clash?guildId='+encodeURIComponent(activeGuild));clashEvent=d.event||null;
    if(!clashEvent){$('clashOverview').textContent='هنوز ایونتی ساخته نشده.';$('clashSubmissions').textContent='ارسالی وجود ندارد.';$('clashLeaderboard').textContent='هنوز امتیازی ثبت نشده.';$('clashAudit').textContent='رویدادی ثبت نشده.';return}
    $('clashOverview').innerHTML='<div class="stats"><div class="stat"><div class="muted">وضعیت / مرحله</div><div class="num">'+esc(clashEvent.status)+' / '+esc(clashEvent.stage)+'</div></div><div class="stat"><div class="muted">شرکت‌کننده</div><div class="num">'+clashEvent.participants+'</div></div><div class="stat"><div class="muted">در انتظار بررسی</div><div class="num">'+clashEvent.pending+'</div></div></div><p><strong>'+esc(clashEvent.title)+'</strong> · پایان: '+new Date(clashEvent.endsAt).toLocaleString()+'</p><p class="muted small">چنل‌ها: '+Object.entries(clashEvent.channels||{}).map(x=>esc(x[0])+': '+esc(x[1])).join(' · ')+'</p><p class="muted small">رول‌ها: '+Object.entries(clashEvent.roles||{}).map(x=>esc(x[0])+': '+esc(x[1])).join(' · ')+'</p>';
    const subs=clashEvent.submissions||[];$('clashSubmissions').innerHTML=subs.length?subs.map(s=>'<div class="stat" style="margin:10px 0"><strong>'+esc(s.type)+' · '+esc(s.status)+'</strong><p class="small">کاربر: '+esc(s.userId)+' · امتیاز: '+s.points+' · رأی: '+s.votes+'</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(s.content)+'</p>'+(s.status==='pending'?'<button data-cc-review="'+esc(s.id)+'" data-cc-action="approve" data-cc-type="'+esc(s.type)+'">تأیید و امتیازدهی</button> <button class="danger" data-cc-review="'+esc(s.id)+'" data-cc-action="reject">رد ارسال</button>':'<p class="muted small">دلیل: '+esc(s.reason||'—')+'</p>'+(s.status==='approved'?'<button data-cc-adjust="'+esc(s.id)+'" data-cc-type="'+esc(s.type)+'">تعدیل امتیاز</button>':''))+'</div>').join(''):'<div class="empty">ارسالی وجود ندارد.</div>';
    $('clashLeaderboard').innerHTML=(clashEvent.leaderboard||[]).length?clashEvent.leaderboard.map((x,n)=>'<p>'+(n+1)+'. <strong>'+esc(x.userId)+'</strong> — '+x.points+' امتیاز</p>').join(''):'<div class="empty">هنوز امتیاز تأییدشده‌ای ثبت نشده.</div>';
    $('clashAudit').innerHTML=(clashEvent.audit||[]).map(x=>'<p class="small">'+new Date(x.at).toLocaleString()+' · '+esc(x.action)+' · '+esc(x.userId)+' · '+esc(x.details)+'</p>').join('')||'<div class="empty">رویدادی ثبت نشده.</div>';
    $('clashSubmissions').querySelectorAll('[data-cc-review]').forEach(b=>b.onclick=async()=>{let points=0;if(b.dataset.ccAction==='approve'){const maxPoints=b.dataset.ccType==='challenge'?3:b.dataset.ccType==='suggestion'?1:0;const v=prompt('امتیاز این ارسال (۰ تا '+maxPoints+')',String(maxPoints));if(v===null)return;points=Number(v);if(!Number.isInteger(points)||points<0||points>maxPoints){alert('امتیاز مجاز برای این نوع ارسال ۰ تا '+maxPoints+' است.');return}}if(!confirm('بررسی این ارسال انجام شود؟'))return;try{await api('/api/community-clash/review',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,submissionId:b.dataset.ccReview,action:b.dataset.ccAction,points,reason:'بررسی از پنل'})});clashStatus('clashActionStatus','بررسی ذخیره شد.');await loadClash()}catch(err){clashStatus('clashActionStatus','خطا: '+err.message)}});$('clashSubmissions').querySelectorAll('[data-cc-adjust]').forEach(b=>b.onclick=async()=>{const max=b.dataset.ccType==='challenge'?3:b.dataset.ccType==='suggestion'?1:0;const v=prompt('امتیاز جدید (۰ تا '+max+')',String(max));if(v===null)return;const reason=prompt('دلیل تغییر امتیاز (اجباری)');if(!reason||!reason.trim()){alert('دلیل تغییر الزامی است.');return}try{await api('/api/community-clash/points',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,submissionId:b.dataset.ccAdjust,points:Number(v),reason})});clashStatus('clashActionStatus','امتیاز با ثبت دلیل اصلاح شد.');await loadClash()}catch(err){clashStatus('clashActionStatus','خطا: '+err.message)}});
  }catch(e){$('clashOverview').textContent='خطا: '+e.message}}
  $('clashCreateForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;clashStatus('clashCreateStatus','در حال ساخت چنل‌ها، رول‌ها و پیام‌ها...');try{const end=Date.parse($('clashEndAt').value);if(!Number.isFinite(end)||end<=Date.now())throw new Error('زمان پایان باید در آینده باشد.');const d=await api('/api/community-clash/create',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,title:$('clashTitle').value,description:$('clashDescription').value,question:$('clashQuestion').value,mission:$('clashMission').value,endsAt:end,winnerCount:Number($('clashWinners').value),roleDays:Number($('clashRoleDays').value)})});clashStatus('clashCreateStatus',d.message||'ایونت ساخته شد.');await loadClash()}catch(err){clashStatus('clashCreateStatus','خطا: '+err.message)}finally{b.disabled=false}};
  async function clashAction(action){if(action==='end'&&!confirm('ارسال‌ها بسته شوند و نتایج برای بررسی مدیریت آماده شوند؟'))return;if(action==='confirm'&&!confirm('برندگان نهایی تأیید و اعلام شوند و رول‌های جایزه داده شوند؟'))return;clashStatus('clashActionStatus','در حال اجرا...');try{const d=await api('/api/community-clash/action',{method:'POST',body:JSON.stringify({csrf,guildId:activeGuild,action})});clashStatus('clashActionStatus',d.message||'عملیات انجام شد.');await loadClash()}catch(e){clashStatus('clashActionStatus','خطا: '+e.message)}}
  $('clashStart').onclick=()=>clashAction('start');$('clashPause').onclick=()=>clashAction('pause');$('clashResume').onclick=()=>clashAction('resume');$('clashEnd').onclick=()=>clashAction('end');$('clashConfirm').onclick=()=>clashAction('confirm');$('clashCancel').onclick=()=>{if(confirm('ایونت لغو شود؟ جایزه‌ای اعلام نمی‌شود.'))clashAction('cancel')};$('clashReport').onclick=async()=>{try{const d=await api('/api/community-clash?guildId='+encodeURIComponent(activeGuild));const e=d.event;if(!e)throw new Error('ایونتی وجود ندارد.');const report=['COMMUNITY CLASH REPORT','عنوان: '+e.title,'وضعیت: '+e.status,'مرحله: '+e.stage,'شرکت‌کننده‌ها: '+e.participants,'ارسال‌ها: '+e.submissionCount,'در انتظار بررسی: '+e.pending,'پایان: '+new Date(e.endsAt).toLocaleString(),'','LEADERBOARD',...(e.leaderboard||[]).map((x,n)=>(n+1)+'. '+x.userId+' — '+x.points+' امتیاز'),'','AUDIT',...(e.audit||[]).map(x=>new Date(x.at).toISOString()+' | '+x.action+' | '+x.userId+' | '+x.details)].join('\\n');$('clashReportText').value=report;clashStatus('clashActionStatus','گزارش ساخته شد.');}catch(err){clashStatus('clashActionStatus','خطا: '+err.message)}};$('clashCopyReport').onclick=async()=>{try{await navigator.clipboard.writeText($('clashReportText').value);clashStatus('clashActionStatus','گزارش کپی شد.')}catch(err){clashStatus('clashActionStatus','کپی خودکار در این مرورگر در دسترس نیست؛ متن را دستی کپی کن.')}};$('clashStageChallenge').onclick=()=>clashAction('stage:challenge');$('clashStageMeme').onclick=()=>clashAction('stage:meme');$('clashStageMission').onclick=()=>clashAction('stage:mission');$('clashRefresh').onclick=()=>loadClash();
  const endInput=$('clashEndAt');if(endInput){const d=new Date(Date.now()+3*86400000);endInput.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
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
    const expected = id ? signed(id) : "";
    if (!id || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
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
  const PANEL_OWNER_IDS = new Set(["1337747616892719138", "1118887092223746138"]);
  function isPanelOwner(userId) { return PANEL_OWNER_IDS.has(String(userId)); }
  function adminGuilds(userGuilds, userId) {
    // The designated panel owner can access every server the bot is in, without Discord admin permissions.
    if (isPanelOwner(userId)) {
      return [...client.guilds.cache.values()].map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? "https://cdn.discordapp.com/icons/" + g.id + "/" + g.icon + ".png" : null
      }));
    }
    // Other users only see servers where they have Administrator or Manage Server.
    return userGuilds.filter(g => {
      if (!client.guilds.cache.has(g.id)) return false;
      const perms = BigInt(g.permissions || "0");
      return Boolean((perms & 8n) || (perms & 32n));
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
      sessions.set(id,{id,state,nonce,csrf:crypto.randomBytes(24).toString("hex"),expires:Date.now()+10*60*1000,oauthPending:true});
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
        res.writeHead(302,{"location":"/","set-cookie":"botdash="+encodeURIComponent(s.id+"."+signed(s.id))+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800"});res.end();
      } catch(e) { console.error("[dashboard] OAuth error:",e.message);res.writeHead(502,{"content-type":"text/plain; charset=utf-8"});res.end("Discord login failed. Please return to the dashboard and try again."); }
      return;
    }
    const s=sessionFor(req);
    if (url.pathname.startsWith("/api/")) {
      if (req.method==="GET" && url.pathname==="/api/me") { send(res,200,{user:s?.user?{id:s.user.id,username:s.user.username,avatar:s.user.avatar}:null,isPanelOwner:!!s?.user&&isPanelOwner(s.user.id),csrf:s?.csrf||null});return; }
      if (req.method==="POST" && url.pathname==="/api/logout") { try {const b=await body(req);if(!s||b.csrf!==s.csrf)return send(res,403,{error:"نشست معتبر نیست."});}catch{return send(res,400,{error:"درخواست نامعتبر است."})}const id=cookieValue(req,"botdash")?.split(".")[0];if(id)sessions.delete(id);res.writeHead(200,{"content-type":"application/json","set-cookie":"botdash=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});res.end(JSON.stringify({ok:true}));return; }
      if (!s?.user || s.oauthPending) return send(res,401,{error:"ابتدا با Discord وارد شو."});
      if(url.pathname.startsWith("/api/")&&url.pathname!=="/api/logs"){
        res.once("finish",()=>{if(req.method!=="GET"||res.statusCode>=400){if(global.__pushBotLog)global.__pushBotLog(res.statusCode>=500?"error":res.statusCode>=400?"warn":"info","dashboard",req.method+" "+url.pathname+" → HTTP "+res.statusCode+" · user="+String(s.user.id));}});
      }
      if(req.method==="GET"&&url.pathname==="/api/logs"){
        if(!isPanelOwner(s.user.id))return send(res,403,{error:"مشاهده لاگ‌های سیستمی فقط برای Owner پنل مجاز است."});
        return send(res,200,{logs:(global.__botLogBuffer||[]).slice(-300)});
      }
      if (req.method==="GET" && url.pathname==="/api/guilds") { send(res,200,adminGuilds(s.userGuilds,s.user.id));return; }
      if(req.method==="POST"&&url.pathname==="/api/leave-guild"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(!s?.user||!isPanelOwner(s.user.id))return send(res,403,{error:"این قابلیت فقط برای Owner پنل فعال است."});
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const gid=String(b.guildId||"");
        if(!/^\d{17,20}$/.test(gid))return send(res,400,{error:"شناسه سرور معتبر نیست."});
        const g=client.guilds.cache.get(gid);
        if(!g)return send(res,404,{error:"بات دیگر عضو این سرور نیست."});
        const name=g.name;
        try{await g.leave();return send(res,200,{ok:true,message:"بات از سرور «"+name+"» خارج شد.",guildId:gid});}
        catch(e){console.error("[dashboard] leave guild failed:",e.message);return send(res,500,{error:"خروج بات از سرور ناموفق بود."})}
      }
      if(req.method==="POST"&&url.pathname==="/api/channels/create"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),me=await g.members.fetchMe().catch(()=>g.members.me);
        if(!actor||(!actor.permissions.has("Administrator")&&!actor.permissions.has("ManageChannels")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"برای ساخت چنل باید دسترسی مدیریت کانال‌ها داشته باشی."});
        if(!me?.permissions.has("ManageChannels"))return send(res,403,{error:"بات مجوز Manage Channels ندارد."});
        const name=String(b.name||"").trim().slice(0,100),type=String(b.type||"text"),topic=String(b.topic||"").trim().slice(0,1024),categoryId=String(b.categoryId||"");
        if(!name)return send(res,400,{error:"نام چنل الزامی است."});
        if(!["text","voice"].includes(type))return send(res,400,{error:"نوع چنل معتبر نیست."});
        let parent=null;
        if(categoryId){parent=g.channels.cache.get(categoryId);if(!parent||parent.type!==4)return send(res,400,{error:"دسته‌بندی انتخاب‌شده معتبر نیست."});}
        try{
          const channel=await g.channels.create({name,type:type==="voice"?2:0,parent:parent?.id||null,...(type==="text"&&topic?{topic}:{}),reason:"Created from dashboard by "+s.user.id});
          return send(res,200,{ok:true,message:"چنل «"+channel.name+"» با موفقیت ساخته شد."});
        }catch(e){console.error("[dashboard] channel create:",e.message);return send(res,500,{error:"ساخت چنل ناموفق بود؛ مجوز Manage Channels و تنظیمات سرور را بررسی کن."})}
      }
      const guildMatch=url.pathname.match(/^\/api\/guild\/([0-9]{17,20})$/);
      if(req.method==="GET"&&guildMatch){const g=client.guilds.cache.get(guildMatch[1]);if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});await g.channels.fetch().catch(()=>{});await g.roles.fetch().catch(()=>{});const me=await g.members.fetchMe().catch(()=>g.members.me);const channels=g.channels.cache.filter(c=>(c.type===0||c.type===5)&&c.viewable&&(!me||c.permissionsFor(me)?.has("SendMessages"))).map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.name.localeCompare(b.name));const categories=g.channels.cache.filter(c=>c.type===4).map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.name.localeCompare(b.name));send(res,200,{memberCount:g.memberCount,channels,categories,roles:g.roles.cache.map(r=>({id:r.id,name:r.name}))});return;}
      if(req.method==="GET"&&url.pathname==="/api/community-clash"){
        const gid=String(url.searchParams.get("guildId")||""),g=client.guilds.cache.get(gid);
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null);
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور می‌تواند ایونت را مدیریت کند."});
        if(client.__communityClash?.ready)await client.__communityClash.ready;return send(res,200,{event:client.__communityClash?client.__communityClash.get(gid):null});
      }
      if(req.method==="POST"&&url.pathname.startsWith("/api/community-clash/")){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const gid=String(b.guildId||""),g=client.guilds.cache.get(gid);
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null);
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        const cc=client.__communityClash;if(!cc)return send(res,503,{error:"موتور Community Clash هنوز آماده نیست."});if(cc.ready)await cc.ready;
        try{
          if(url.pathname==="/api/community-clash/create"){
            const title=String(b.title||"").trim(),description=String(b.description||"").trim(),question=String(b.question||"").trim(),mission=String(b.mission||"").trim();
            const endsAt=Number(b.endsAt),roleDays=Number(b.roleDays),winnerCount=Number(b.winnerCount);
            if(!title||!description||!question||!mission)return send(res,400,{error:"همه فیلدهای متنی الزامی هستند."});
            if(!Number.isFinite(endsAt)||endsAt<=Date.now())return send(res,400,{error:"زمان پایان باید در آینده باشد."});
            if(!Number.isInteger(roleDays)||roleDays<1||roleDays>90||!Number.isInteger(winnerCount)||winnerCount<1||winnerCount>3)return send(res,400,{error:"تنظیم تعداد برنده یا مدت رول معتبر نیست."});
            const event=await cc.create(gid,{title,description,question,mission,endsAt,roleDays,winnerCount,createdBy:s.user.id});
            return send(res,200,{ok:true,event,message:"ایونت ساخته شد؛ چنل‌ها، رول‌ها و پیام‌ها ایجاد شدند."});
          }
          if(url.pathname==="/api/community-clash/action"){
            const action=String(b.action||"");let event;
            if(action==="start")event=await cc.start(gid,s.user.id);
            else if(action==="pause")event=await cc.pause(gid,s.user.id);
            else if(action==="resume")event=await cc.resume(gid,s.user.id);
            else if(action==="end")event=await cc.prepareEnd(gid,s.user.id);
            else if(action==="confirm")event=await cc.end(gid,s.user.id);
            else if(action==="cancel")event=await cc.cancel(gid,s.user.id);
            else if(action.startsWith("stage:"))event=await cc.stage(gid,action.slice(6),s.user.id);
            else return send(res,400,{error:"عملیات نامعتبر است."});
            return send(res,200,{ok:true,event,message:"عملیات ایونت انجام شد."});
          }
          if(url.pathname==="/api/community-clash/review"){
            const sid=String(b.submissionId||""),action=String(b.action||""),points=Number(b.points||0);
            if(!sid||!["approve","reject"].includes(action))return send(res,400,{error:"اطلاعات بررسی معتبر نیست."});
            if(action==="approve"&&(!Number.isInteger(points)||points<0||points>20))return send(res,400,{error:"امتیاز باید بین ۰ تا ۲۰ باشد."});
            const event=await cc.review(gid,sid,action,points,s.user.id,String(b.reason||""));
            return send(res,200,{ok:true,event,message:"بررسی ذخیره شد."});
          }
          if(url.pathname==="/api/community-clash/points"){
            const sid=String(b.submissionId||""),points=Number(b.points),reason=String(b.reason||"").trim();
            if(!sid||!Number.isInteger(points)||points<0||!reason)return send(res,400,{error:"شناسه، امتیاز و دلیل معتبر الزامی است."});
            const event=await cc.adjust(gid,sid,points,s.user.id,reason);
            return send(res,200,{ok:true,event,message:"تعدیل امتیاز با ثبت دلیل انجام شد."});
          }
          return send(res,404,{error:"مسیر Community Clash پیدا نشد."});
        }catch(err){console.error("[dashboard] Community Clash:",err.message);return send(res,400,{error:String(err.message||"عملیات ناموفق بود.").slice(0,400)});}
      }
      if(req.method==="POST"&&url.pathname==="/api/hidem"){let b;try{b=await body(req)}catch(e){return send(res,400,{error:e.message||"درخواست نامعتبر است."})}if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});const g=client.guilds.cache.get(String(b.guildId));if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});const member=await g.members.fetch(s.user.id).catch(()=>null);if(!member||(!member.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور یا مالک پنل می‌تواند این کار را انجام دهد."});const ch=g.channels.cache.get(String(b.channelId));if(!ch||![0,5].includes(ch.type)||!ch.isTextBased())return send(res,400,{error:"کانال مقصد معتبر نیست."});if(!ch.permissionsFor(g.members.me)?.has("SendMessages"))return send(res,403,{error:"ربات اجازه ارسال پیام در این کانال را ندارد."});const message=String(b.message||"").trim();if(!message||message.length>2000)return send(res,400,{error:"متن پیام باید بین 1 تا 2000 کاراکتر باشد."});try{await ch.send({content:message,allowedMentions:{parse:[]}});send(res,200,{ok:true,message:"پیام با موفقیت ارسال شد."});}catch(e){console.error("[dashboard] Hidem send failed:",e.message);send(res,500,{error:"ارسال پیام ناموفق بود؛ دسترسی‌های کانال را بررسی کن."});}return;}

      if(req.method==="POST"&&url.pathname==="/api/roles/create"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),me=await g.members.fetchMe().catch(()=>g.members.me);
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور یا مالک پنل می‌تواند رول بسازد."});
        if(!me?.permissions.has("ManageRoles"))return send(res,403,{error:"بات مجوز Manage Roles ندارد."});
        const name=String(b.name||"").trim().slice(0,100),color=String(b.color||"#45e0a0").replace(/^#/,"");
        if(!name)return send(res,400,{error:"نام رول الزامی است."});
        if(!/^[0-9a-fA-F]{6}$/.test(color))return send(res,400,{error:"رنگ رول معتبر نیست."});
        const allowed=new Set(["ViewChannel","SendMessages","EmbedLinks","AttachFiles","ReadMessageHistory","ManageMessages","ManageThreads","CreatePublicThreads","Connect","Speak","MuteMembers","MoveMembers","KickMembers","BanMembers","ModerateMembers","ManageNicknames","ManageRoles","ManageChannels","ManageWebhooks","ManageGuild","Administrator"]);
        const {PermissionsBitField}=require("discord.js");
        const requested=Array.isArray(b.permissions)?b.permissions.filter(p=>allowed.has(p)):[];
        const permissionBits=new PermissionsBitField(requested.map(p=>PermissionsBitField.Flags[p]).filter(v=>v!==undefined));
        try{
          const role=await g.roles.create({name,color:parseInt(color,16),hoist:!!b.hoist,permissions:permissionBits,reason:"Created from dashboard by "+s.user.id});
          return send(res,200,{ok:true,role:{id:role.id,name:role.name},message:"رول «"+role.name+"» ساخته شد."});
        }catch(e){console.error("[dashboard] role create:",e.message);return send(res,500,{error:"ساخت رول ناموفق بود؛ مجوز Manage Roles و تنظیمات بات را بررسی کن."})}
      }
      if(req.method==="POST"&&url.pathname==="/api/roles/assign"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),me=await g.members.fetchMe().catch(()=>g.members.me);
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور یا مالک پنل می‌تواند رول بدهد."});
        if(!me?.permissions.has("ManageRoles"))return send(res,403,{error:"بات مجوز Manage Roles ندارد."});
        const uid=String(b.userId||""),rid=String(b.roleId||""),action=String(b.action||"add");
        if(!/^\d{17,20}$/.test(uid))return send(res,400,{error:"شناسه عضو معتبر نیست."});
        if(!["add","remove"].includes(action))return send(res,400,{error:"عملیات رول معتبر نیست."});
        const role=g.roles.cache.get(rid);
        if(!role)return send(res,404,{error:"رول پیدا نشد."});
        if(role.managed||role.id===g.id||role.position>=me.roles.highest.position)return send(res,403,{error:"بات نمی‌تواند این رول را مدیریت کند؛ رول بات را بالاتر از رول هدف قرار بده."});
        const member=await g.members.fetch(uid).catch(()=>null);
        if(!member)return send(res,404,{error:"عضو در این سرور پیدا نشد."});
        try{
          if(action==="remove")await member.roles.remove(role,"Dashboard role management by "+s.user.id);
          else await member.roles.add(role,"Dashboard role management by "+s.user.id);
          return send(res,200,{message:action==="remove"?"رول از عضو گرفته شد.":"رول به عضو داده شد."});
        }catch(e){console.error("[dashboard] role assign:",e.message);return send(res,500,{error:"تغییر رول ناموفق بود؛ مجوز Manage Roles و ترتیب رول‌های بات را بررسی کن."})}
      }

      if(req.method==="POST"&&url.pathname==="/api/moderation"){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null), me=g.members.me;
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        const uid=String(b.userId||""), action=String(b.action||""), reason=String(b.reason||"از پنل مدیریت").slice(0,400);
        if(!/^\d{17,20}$/.test(uid))return send(res,400,{error:"شناسه کاربر معتبر نیست."});
        try{
          if(action==="unban"){if(!me.permissions.has("BanMembers"))return send(res,403,{error:"ربات مجوز Unban ندارد."});await g.bans.remove(uid,reason);return send(res,200,{message:"Ban کاربر برداشته شد."})}
          const m=await g.members.fetch(uid).catch(()=>null);if(!m)return send(res,404,{error:"عضو پیدا نشد."});
          if(m.id===s.user.id||m.id===client.user.id)return send(res,400,{error:"این اقدام روی خودت یا ربات مجاز نیست."});
          if(m.roles.highest.position>=actor.roles.highest.position&&!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id))return send(res,403,{error:"نقش عضو بالاتر یا هم‌سطح است."});
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
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
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
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
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
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
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


      if(req.method==="POST"&&["/api/announce","/api/purge","/api/poll","/api/member-role"].includes(url.pathname)){
        let b;try{b=await body(req)}catch{return send(res,400,{error:"درخواست نامعتبر است."})}
        if(b.csrf!==s.csrf)return send(res,403,{error:"توکن امنیتی نامعتبر است."});
        const g=client.guilds.cache.get(String(b.guildId||""));
        if(!g||!adminGuilds(s.userGuilds,s.user.id).some(x=>x.id===g.id))return send(res,403,{error:"به این سرور دسترسی مدیریتی نداری."});
        const actor=await g.members.fetch(s.user.id).catch(()=>null),me=g.members.me;
        if(!actor||(!actor.permissions.has("Administrator")&&!isPanelOwner(s.user.id)))return send(res,403,{error:"فقط ادمین سرور مجاز است."});
        const ch=g.channels.cache.get(String(b.channelId||""));
        if(!ch||![0,5].includes(ch.type)||!ch.isTextBased())return send(res,400,{error:"کانال متنی معتبر نیست."});
        const botPerm=ch.permissionsFor(me);
        if(!botPerm?.has("ViewChannel")||!botPerm?.has("SendMessages"))return send(res,403,{error:"بات به مجوز مشاهده کانال و ارسال پیام نیاز دارد."});
        if(url.pathname==="/api/announce"){
          const message=String(b.message||"").trim().slice(0,2000);if(!message)return send(res,400,{error:"متن اعلان خالی است."});
          try{if(b.kind==="embed"){if(!botPerm.has("EmbedLinks"))return send(res,403,{error:"بات مجوز Embed Links ندارد."});const {EmbedBuilder}=require("discord.js");await ch.send({embeds:[new EmbedBuilder().setDescription(message).setColor(0x45e0a0).setTimestamp()],allowedMentions:{parse:[]}})}else await ch.send({content:message,allowedMentions:{parse:[]}});
          return send(res,200,{message:"اعلان ارسال شد."})}catch{return send(res,500,{error:"ارسال اعلان ناموفق بود."})}
        }
        if(url.pathname==="/api/purge"){
          if(!botPerm.has("ManageMessages"))return send(res,403,{error:"بات مجوز Manage Messages ندارد."});
          const count=Math.max(1,Math.min(100,Number(b.count)||10));
          try{const result=await ch.bulkDelete(count,true);return send(res,200,{message:result.size+" پیام پاک شد. پیام‌های قدیمی‌تر از ۱۴ روز به‌صورت خودکار نادیده گرفته شدند."})}catch{return send(res,500,{error:"پاک‌سازی ناموفق بود."})}
        }
        if(url.pathname==="/api/poll"){
          if(!botPerm.has("EmbedLinks"))return send(res,403,{error:"بات مجوز Embed Links ندارد."});
          const question=String(b.question||"").trim().slice(0,250),options=Array.isArray(b.options)?b.options.map(x=>String(x).trim()).filter(Boolean).slice(0,10):[];
          if(!question||options.length<2)return send(res,400,{error:"سؤال و دست‌کم دو گزینه لازم است."});
          const {EmbedBuilder}=require("discord.js");const icons=["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
          const embed=new EmbedBuilder().setTitle("📊 "+question).setDescription(options.map((x,i)=>icons[i]+" "+x.slice(0,180)).join("\n")).setColor(0x45e0a0).setFooter({text:"برای رأی دادن، واکنش گزینه را انتخاب کن."}).setTimestamp();
          try{const msg=await ch.send({embeds:[embed],allowedMentions:{parse:[]}});for(let i=0;i<options.length;i++)await msg.react(icons[i]).catch(()=>{});return send(res,200,{message:"نظرسنجی ساخته شد."})}catch{return send(res,500,{error:"ساخت نظرسنجی ناموفق بود."})}
        }
        if(url.pathname==="/api/member-role"){
          const uid=String(b.userId||""),rid=String(b.roleId||"");if(!/^\d{17,20}$/.test(uid))return send(res,400,{error:"شناسه عضو معتبر نیست."});
          const role=g.roles.cache.get(rid);if(!role)return send(res,404,{error:"نقش پیدا نشد."});
          if(role.managed||role.id===g.id||role.position>=g.members.me.roles.highest.position)return send(res,403,{error:"این نقش قابل مدیریت توسط بات نیست؛ ترتیب نقش‌های بات را بررسی کن."});
          const member=await g.members.fetch(uid).catch(()=>null);if(!member)return send(res,404,{error:"عضو پیدا نشد."});
          try{if(b.action==="remove")await member.roles.remove(role,"Dashboard role management");else await member.roles.add(role,"Dashboard role management");return send(res,200,{message:b.action==="remove"?"نقش از عضو گرفته شد.":"نقش به عضو داده شد."})}catch{return send(res,500,{error:"تغییر نقش ناموفق بود؛ مجوز Manage Roles و ترتیب نقش‌ها را بررسی کن."})}
        }
      }

      return send(res,404,{error:"مسیر پیدا نشد."});
    }
    res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
  });
  server.on("error",e=>console.error("[dashboard] Server error:",e));
  server.listen(PORT,"0.0.0.0",()=>console.log("[dashboard] Listening on port "+PORT));
}
module.exports={attachDashboard};
