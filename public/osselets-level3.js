(() => {
  (() => {
    const { useEffect, useRef } = window.React;
    function AstragalusLevel3() {
      const hostRef = useRef(null);
      useEffect(() => {
        let destroyed = false;
        let instance = null;
        function boot() {
          if (destroyed)
            return;
          const api = window.OsseletsDice5;
          const host = hostRef.current;
          if (!api || !api.mount || !host)
            return;
          api.mount(host).then((inst) => {
            instance = inst;
          }).catch(console.error);
        }
        if (!window.OsseletsDice5) {
          const s = document.createElement("script");
          s.src = "/osselets-dice5.js";
          s.async = true;
          s.onload = boot;
          s.onerror = () => console.warn("[L3] /osselets-dice5.js introuvable.");
          document.head.appendChild(s);
        } else {
          boot();
        }
        return () => {
          destroyed = true;
          try {
            instance?.destroy?.();
          } catch {
          }
        };
      }, []);
      return window.React.createElement("div", { style: { position: "relative" } }, window.React.createElement("div", { ref: hostRef }));
    }
    window.AstragalusLevel3 = AstragalusLevel3;
  })();
})();
