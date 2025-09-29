/* osselets-level3.tsx — Wrapper React pour intégrer /osselets-dice5.js sans changer ton HTML */
;(()=>{
  // @ts-ignore
  const { useEffect, useRef } = window.React;

  function AstragalusLevel3(){
    const hostRef = useRef(null);

    useEffect(()=>{
      let destroyed = false;
      let instance = null;

      function boot(){
        if (destroyed) return;
        const api = (window as any).OsseletsDice5;
        const host = hostRef.current;
        if (!api || !api.mount || !host) return;
        api.mount(host).then((inst:any)=>{ instance = inst; }).catch(console.error);
      }

      // Charge le moteur s’il n’est pas déjà présent
      if (!(window as any).OsseletsDice5){
        const s = document.createElement('script');
        s.src = '/osselets-dice5.js';
        s.async = true;
        s.onload = boot;
        s.onerror = ()=>console.warn('[L3] /osselets-dice5.js introuvable.');
        document.head.appendChild(s);
      } else {
        boot();
      }

      return ()=>{ destroyed = true; try { instance?.destroy?.(); } catch {} };
    },[]);

    // Pas de JSX => compatible Babel in-browser & TSX transform
    // @ts-ignore
    return window.React.createElement('div', {style:{position:'relative'}},
      // @ts-ignore
      window.React.createElement('div', {ref:hostRef})
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
