/* ====== EDIT ME: your numbers ====== */
  const WHATSAPP = "254745505324";   // international format, no + or spaces
  const PHONE    = "0745505324";

  document.getElementById('callLink').href = "tel:" + PHONE;
  document.getElementById('fabCall').href = "tel:" + PHONE;

  document.querySelectorAll('[data-wa]').forEach(el=>{
    el.style.cursor='pointer';
    el.addEventListener('click', e=>{
      e.preventDefault();
      const msg = encodeURIComponent(el.getAttribute('data-wa'));
      window.open(`https://wa.me/${WHATSAPP}?text=${msg}`,'_blank');
    });
  });

  document.getElementById('yr').textContent = new Date().getFullYear();

  const burger=document.getElementById('burger'), menu=document.getElementById('menu');
  burger.addEventListener('click',()=>{const o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o)});
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');burger.setAttribute('aria-expanded',false)}));

  const io=new IntersectionObserver((es)=>{es.forEach((en,i)=>{if(en.isIntersecting){en.target.style.transitionDelay=(i%4*0.06)+'s';en.target.classList.add('in');io.unobserve(en.target)}})},{threshold:.12});
  document.querySelectorAll('.rise').forEach(el=>io.observe(el));
  document.querySelectorAll('.hero .rise').forEach((el,i)=>{el.style.transitionDelay=(i*0.08)+'s';requestAnimationFrame(()=>el.classList.add('in'))});

  /* ====== EDIT ME: your social media links (put your real page/handle URLs) ====== */
  const SOCIAL = {
    Facebook : "https://facebook.com/",      // e.g. https://facebook.com/subietech
    Instagram: "https://instagram.com/",     // e.g. https://instagram.com/subietech
    TikTok   : "https://tiktok.com/",        // e.g. https://tiktok.com/@subietech
    YouTube  : "https://youtube.com/",       // e.g. https://youtube.com/@subietech
    X        : "https://x.com/",             // e.g. https://x.com/subietech
    LinkedIn : "https://linkedin.com/"       // e.g. https://linkedin.com/company/subietech
  };
  const ICONS = {
    Facebook :'<svg viewBox="0 0 24 24"><path d="M14 9h3V6h-3c-1.66 0-3 1.34-3 3v2H8v3h3v7h3v-7h2.5l.5-3H14V9.5c0-.28.22-.5.5-.5z"/></svg>',
    Instagram:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.2"/></svg>',
    TikTok   :'<svg viewBox="0 0 24 24"><path d="M16 3c.3 2 1.6 3.5 3.6 3.7v2.4c-1.3 0-2.6-.4-3.6-1.1V15a5 5 0 1 1-5-5c.3 0 .6 0 .9.1v2.6A2.4 2.4 0 1 0 13 15V3h3z"/></svg>',
    YouTube  :'<svg viewBox="0 0 24 24"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5A3 3 0 0 0 22 15.8 31 31 0 0 0 22.3 12 31 31 0 0 0 22 8.2zM10 15V9l5.2 3z"/></svg>',
    X        :'<svg viewBox="0 0 24 24"><path d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-5.7L5.5 21h-3l7-8L2.1 3H8.3l4.2 5.2zm-1 16h1.7L7.6 4.8H5.8z"/></svg>',
    LinkedIn :'<svg viewBox="0 0 24 24"><path d="M6.9 8.6H3.6V21h3.3zM5.25 3.4a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM21 21h-3.3v-6c0-1.5-.54-2.5-1.9-2.5-1 0-1.6.7-1.9 1.4-.1.25-.12.6-.12.94V21h-3.3s.04-10.9 0-12h3.3v1.7c.44-.68 1.22-1.65 3-1.65 2.2 0 3.84 1.43 3.84 4.5z"/></svg>'
  };
  function buildSocial(id){
    const box=document.getElementById(id); if(!box) return;
    Object.keys(SOCIAL).forEach(name=>{
      const url=SOCIAL[name]; if(!url) return;
      const a=document.createElement('a');
      a.href=url; a.target="_blank"; a.rel="noopener"; a.setAttribute('aria-label',name);
      a.innerHTML=ICONS[name]; box.appendChild(a);
    });
  }
  buildSocial('socialContact'); buildSocial('socialFooter');

  /* ====== Booking form -> WhatsApp ====== */
  function sendBooking(){
    const val=id=>(document.getElementById(id).value||"").trim();
    const name=val('bkName'), model=val('bkModel'), year=val('bkYear'),
          svc=document.getElementById('bkService').value, area=val('bkArea'),
          when=val('bkWhen'), notes=val('bkNotes');
    let ok=true;
    [['bkName',name],['bkService',svc]].forEach(([f,v])=>{
      const el=document.getElementById(f);
      if(!v){el.classList.add('bk-err'); ok=false;} else el.classList.remove('bk-err');
    });
    if(!ok) return;
    let m="*BOOKING — SUBIE TECH*\n";
    m+="\nName: "+name;
    const car=[model,year].filter(Boolean).join(" ");
    if(car) m+="\nSubaru: "+car;
    m+="\nService: "+svc;
    if(area) m+="\nLocation: "+area;
    if(when) m+="\nPreferred: "+when;
    if(notes) m+="\nDetails: "+notes;
    window.open("https://wa.me/"+WHATSAPP+"?text="+encodeURIComponent(m),"_blank");
  }
  document.getElementById('bkSend').addEventListener('click', sendBooking);
