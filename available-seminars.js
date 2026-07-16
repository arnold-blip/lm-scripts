/* ============================================================================
 * SEM : SELECTION : Available Seminars (script)  [PILOT]
 * Host at: https://arnold-blip.github.io/lm-scripts/available-seminars.js
 *
 * WHAT THIS DOES:
 *   Drives the Available Seminars DCMS page (page bound to Registrations 10001;
 *   two grids loop over Events 10000). Runs identically on every OP-rendered card.
 *     1. hydrateSeminarCards() reads each card's hidden [Path//Field] merge spans
 *        (.mf-*) into card.dataset + sets the <img>, description, meeting pattern,
 *        and "Delivered in:" line. (OP merges resolve in text, NOT attributes,
 *        so we feed values through hidden spans and distribute them here.)
 *     2. enhanceCards() splits the course title, builds the compact date line and
 *        the Online/In-Person badge, derives country from the IANA timezone.
 *     3. Country/language filters for the "Other Available Seminars" grid.
 *     4. Confirm modal + DST-correct multi-session .ics ("add to calendar").
 *
 * WHY EXTERNAL (not inline in an OP Custom HTML block):
 *   Ontraport's Custom HTML sanitizer rejects large inline scripts (the Blob /
 *   URL.createObjectURL / a.click() download reads as "suspicious"). A single
 *   <script src> from GitHub Pages passes. All interactivity is wired via event
 *   delegation, so the OP markup carries NO inline on* handlers.
 *
 * OP MARKUP CONTRACT (ids/classes this script drives):
 *   cards: .sem-card > .mf-* (hidden feed), .flip, .flip-cap .fc-eyebrow/.fc-title,
 *          .flip-back p, .sem-photo, .when-day, .when-dates, .sem-lang, .sem-badges,
 *          .sem-select
 *   filters (Other grid): #countryFilter #langFilter #othersGrid #noResults
 *                         #othersToggle #othersBody #othersHint
 *   modal: #confirmOverlay #cmTitle #cmSub #ssCount #ssRange #ssDates
 *          #regForm #regEvent #regCourse #exceptionCheck .confirm-close .confirm-back
 *          #confirmSuccess #successText #addCalBtn
 * ========================================================================== */
(function () {
  'use strict';

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* ---- dates ---- */
  function parseDates(raw){
    return (raw||"").split(/[\n,]+/).map(function(s){return s.trim();}).filter(Boolean).map(function(tok){
      var parts=tok.split(/\s+/), dp=parts[0], tp=parts[1];
      var p=dp.split("-").map(Number);
      return {y:p[0],m:p[1],d:p[2],time:tp||null};
    });
  }
  function compactDates(dates){
    var out=[],lastM=null;
    dates.forEach(function(o){ out.push(o.m!==lastM?MON[o.m-1]+" "+o.d:String(o.d)); lastM=o.m; });
    return out.join(", ");
  }
  function rangeLabel(dates){
    if(!dates.length) return "";
    var a=dates[0], b=dates[dates.length-1];
    var base=MON[a.m-1]+" "+a.d+" – "+MON[b.m-1]+" "+b.d;
    return b.y>a.y ? base+", "+b.y : base;
  }
  function datesValid(dates){ return dates.length>0 && dates.every(function(o){ return o.y>1900 && o.m>=1 && o.m<=12 && o.d>=1 && o.d<=31; }); }
  function rawDateLine(raw){ return (raw||"").split(/[\n,]+/).map(function(s){return s.trim();}).filter(Boolean).join(", "); }
  function parseTime(str){ var m=(str||"").trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if(!m) return null; var h=parseInt(m[1],10), mi=m[2]?parseInt(m[2],10):0, ap=(m[3]||"").toLowerCase(); if(ap==="pm"&&h<12)h+=12; if(ap==="am"&&h===12)h=0; return {h:h,m:mi}; }
  /* ---- date display: compact "Jul 20, 27, Aug 3" when YYYY-MM-DD, else show raw text as typed ---- */
  function dateLine(raw){ var p=parseDates(raw); return datesValid(p)?compactDates(p):rawDateLine(raw); }

  /* ---- IANA + DST-correct wall-time -> UTC (no library) ---- */
  function ianaOf(t){ var m=(t||"").match(/\(([^)]+\/[^)]+)\)/); return m?m[1]:(t||"UTC"); }
  function tzOffset(date,tz){
    var dtf=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
    var p=dtf.formatToParts(date).reduce(function(a,x){a[x.type]=x.value;return a;},{});
    return Date.UTC(p.year,p.month-1,p.day,p.hour==="24"?0:p.hour,p.minute,p.second)-date.getTime();
  }
  function zonedToUTC(y,m,d,hh,mm,tz){ var g=Date.UTC(y,m-1,d,hh,mm,0); return new Date(g-tzOffset(new Date(g),tz)); }
  function icsStamp(dt){ return dt.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""); }
  function buildICS(data){
    var iana=ianaOf(data.tz);
    var st=parseTime(data.start)||{h:19,m:0};
    var en=parseTime(data.end)||{h:22,m:0};
    var L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Landmark//Seminars//EN","CALSCALE:GREGORIAN"];
    data.dates.forEach(function(dt,i){
      var sH=st.h,sM=st.m,eH=en.h,eM=en.m;
      if(dt.time){ var t=parseTime(dt.time); if(t){ sH=t.h; sM=t.m; eH=t.h+3; eM=t.m; } }
      var s=zonedToUTC(dt.y,dt.m,dt.d,sH,sM,iana);
      var e=zonedToUTC(dt.y,dt.m,dt.d,eH,eM,iana);
      L.push("BEGIN:VEVENT","UID:"+data.eventId+"-s"+(i+1)+"@landmark","DTSTAMP:"+icsStamp(new Date()),
        "DTSTART:"+icsStamp(s),"DTEND:"+icsStamp(e),
        "SUMMARY:"+data.course+" – Session "+(i+1)+" of "+data.dates.length,
        "DESCRIPTION:"+(data.pattern||""),"LOCATION:"+(data.zoom||"Online (Zoom)"),"END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n");
  }
  function downloadICS(data){
    if(!datesValid(data.dates)) return;
    var blob=new Blob([buildICS(data)],{type:"text/calendar;charset=utf-8"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=(data.course||"seminar").replace(/[^\w]+/g,"-").toLowerCase()+"-sessions.ics";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  /* ---- IANA -> country (best-effort) ---- */
  var TZ_COUNTRY={"America/New_York":"United States","America/Chicago":"United States","America/Denver":"United States","America/Los_Angeles":"United States","America/Phoenix":"United States","America/Anchorage":"United States","Pacific/Honolulu":"United States","America/Mexico_City":"Mexico","America/Bogota":"Colombia","Europe/London":"United Kingdom","Europe/Paris":"Europe","Europe/Istanbul":"Turkey","Asia/Dubai":"United Arab Emirates","Asia/Kolkata":"India","Asia/Bangkok":"Thailand","Asia/Ho_Chi_Minh":"Vietnam","Asia/Singapore":"Singapore","Asia/Tokyo":"Japan","Australia/Sydney":"Australia","Pacific/Auckland":"New Zealand"};
  function countryFromTZ(t){ return TZ_COUNTRY[ianaOf(t)]||"Other"; }
  function splitTitle(name){ var i=(name||"").indexOf(":"); return i===-1?{eyebrow:name,main:""}:{eyebrow:name.slice(0,i).trim(),main:name.slice(i+1).trim()}; }
  function cardData(card){
    var d=card.dataset;
    return {el:card,eventId:d.eventId,courseId:d.courseId,course:d.course,pattern:d.pattern,
      dates:parseDates(d.dates),datesRaw:d.dates,start:d.start,end:d.end,tz:d.tz,lang:d.lang,format:d.format,zoom:d.zoom};
  }

  /* ---- merge feed -> dataset + visible bits (runs first) ---- */
  function hydrateSeminarCards(){
    document.querySelectorAll(".sem-card").forEach(function(card){
      var mf=function(k){var el=card.querySelector(".mf-"+k);return el?(el.textContent||"").trim():"";};
      ["eventId","courseId","course","image","desc","pattern","dates","start","end","tz","lang","format","zoom"]
        .forEach(function(k){ card.dataset[k]=mf(k); });
      var img=card.querySelector(".sem-photo"); if(img){ img.src=card.dataset.image; img.alt=card.dataset.course; }
      var back=card.querySelector(".flip-back p"); if(back&&!back.textContent) back.textContent=card.dataset.desc;
      var wd=card.querySelector(".when-day"); if(wd&&!wd.textContent) wd.textContent=card.dataset.pattern;
      var lg=card.querySelector(".sem-lang"); if(lg&&!lg.textContent) lg.textContent="Delivered in: "+card.dataset.lang+".";
    });
  }
  function enhanceCards(){
    document.querySelectorAll(".sem-card").forEach(function(card){
      var d=card.dataset, t=splitTitle(d.course);
      var eb=card.querySelector(".fc-eyebrow"), ti=card.querySelector(".fc-title");
      if(eb&&!eb.textContent) eb.textContent=t.eyebrow;
      if(ti&&!ti.textContent) ti.textContent=t.main;
      var wd=card.querySelector(".when-dates"); if(wd&&!wd.textContent) wd.textContent=dateLine(d.dates);
      var b=card.querySelector(".sem-badges");
      if(b&&!b.innerHTML){ var online=/online/i.test(d.format||""); b.innerHTML=online?'<span class="badge badge-online">Online</span>':'<span class="badge badge-inperson">In Person</span>'; }
      if(!d.country) card.dataset.country=countryFromTZ(d.tz);
    });
  }

  /* ---- filters (Other grid) ---- */
  function populateFilters(){
    var cSel=document.getElementById("countryFilter"), lSel=document.getElementById("langFilter");
    if(!cSel||!lSel) return;
    var cards=Array.prototype.slice.call(document.querySelectorAll("#othersGrid .sem-card"));
    var uniq=function(a){return a.filter(function(v,i){return a.indexOf(v)===i;});};
    var countries=uniq(cards.map(function(c){return c.dataset.country;})).sort();
    countries=["United States"].concat(countries.filter(function(c){return c!=="United States";}));
    var langs=uniq(cards.map(function(c){return c.dataset.lang;})).sort();
    cSel.length=1; lSel.length=1;
    countries.forEach(function(c){ cSel.insertAdjacentHTML("beforeend",'<option value="'+c+'">'+c+'</option>'); });
    langs.forEach(function(l){ lSel.insertAdjacentHTML("beforeend",'<option value="'+l+'">'+l+'</option>'); });
    cSel.value="United States";
  }
  function applyFilters(){
    var cf=document.getElementById("countryFilter"); if(!cf) return;
    var country=cf.value, lang=document.getElementById("langFilter").value;
    cf.classList.toggle("selected",country!=="all");
    document.getElementById("langFilter").classList.toggle("selected",lang!=="all");
    var vis=0;
    document.querySelectorAll("#othersGrid .sem-card").forEach(function(card){
      var show=(country==="all"||card.dataset.country===country)&&(lang==="all"||card.dataset.lang===lang);
      card.classList.toggle("hidden",!show); if(show)vis++;
    });
    var nr=document.getElementById("noResults"); if(nr) nr.classList.toggle("show",vis===0);
  }
  function toggleOthers(){
    var body=document.getElementById("othersBody"), head=document.getElementById("othersToggle");
    if(!body||!head) return;
    var open=body.classList.toggle("open"); head.classList.toggle("open",open);
    head.setAttribute("aria-expanded",open);
    var hint=document.getElementById("othersHint"); if(hint) hint.style.display=open?"none":"";
    if(open) head.scrollIntoView({behavior:"smooth",block:"start"});
  }

  /* ---- confirm modal ---- */
  var currentData=null;
  function openConfirm(cardEl){
    var data=cardData(cardEl); currentData=data;
    var set=function(id,val){var el=document.getElementById(id); if(el) el.textContent=val;};
    set("cmTitle",data.course);
    set("cmSub",(data.pattern||"")+(data.format?" · "+data.format:""));
    var validDates=datesValid(data.dates);
    var count=validDates?data.dates.length:rawDateLine(data.datesRaw).split(",").filter(Boolean).length;
    set("ssCount",count+" sessions"+(data.pattern?" · "+data.pattern.split(",")[0]:""));
    set("ssRange",validDates?rangeLabel(data.dates):"");
    set("ssDates",validDates?compactDates(data.dates):rawDateLine(data.datesRaw));
    var ex=document.getElementById("exceptionCheck"); if(ex) ex.checked=false;
    var re=document.getElementById("regEvent"); if(re) re.value=data.eventId||"";
    var rc=document.getElementById("regCourse"); if(rc) rc.value=data.courseId||"";
    var rf=document.getElementById("regForm"); if(rf) rf.style.display="";
    var cs=document.getElementById("confirmSuccess"); if(cs) cs.classList.remove("show");
    var ov=document.getElementById("confirmOverlay"); if(ov) ov.classList.add("show");
    document.body.style.overflow="hidden";
  }
  function closeConfirm(){ var o=document.getElementById("confirmOverlay"); if(o) o.classList.remove("show"); document.body.style.overflow=""; }
  function confirmSelection(e){
    if(e) e.preventDefault();
    var d=currentData; if(!d) return false;
    var st=document.getElementById("successText"); if(st) st.textContent=d.course+" – "+(d.pattern||"")+".";
    var rf=document.getElementById("regForm"); if(rf) rf.style.display="none";
    var cs=document.getElementById("confirmSuccess"); if(cs) cs.classList.add("show");
    var addBtn=document.getElementById("addCalBtn"); if(addBtn) addBtn.style.display=datesValid(d.dates)?"":"none";
    return false;
  }

  /* ---- event delegation (replaces every inline on* handler) ---- */
  document.addEventListener("click",function(e){
    var sel=e.target.closest && e.target.closest(".sem-select");
    if(sel){ var card=sel.closest(".sem-card"); if(card) openConfirm(card); return; }
    var flip=e.target.closest && e.target.closest(".flip");
    if(flip){ flip.classList.toggle("flipped"); return; }
    if(e.target.closest && (e.target.closest(".confirm-close")||e.target.closest(".confirm-back"))){ closeConfirm(); return; }
    if(e.target.id==="confirmOverlay"){ closeConfirm(); return; }
    if(e.target.closest && e.target.closest("#othersToggle")){ toggleOthers(); return; }
    if(e.target.closest && e.target.closest("#addCalBtn")){ if(currentData) downloadICS(currentData); return; }
  });
  document.addEventListener("submit",function(e){ if(e.target.id==="regForm") confirmSelection(e); });
  document.addEventListener("change",function(e){ if(e.target.id==="countryFilter"||e.target.id==="langFilter") applyFilters(); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape") closeConfirm(); });

  /* ---- init ---- */
  function init(){ hydrateSeminarCards(); enhanceCards(); populateFilters(); applyFilters(); }
  if(document.readyState!=="loading") init(); else document.addEventListener("DOMContentLoaded",init);
})();
