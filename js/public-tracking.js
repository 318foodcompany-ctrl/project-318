(async function () {
  "use strict";
  if (window.Project318TrackingStarted) return;
  window.Project318TrackingStarted = true;
  function script(file) {
    return new Promise((resolve,reject) => {
      const element=document.createElement("script");
      element.src="/js/"+file+".js?v=consent-2";
      element.onload=resolve;
      element.onerror=()=>reject(new Error("Could not load "+file));
      document.head.append(element);
    });
  }
  const link=document.createElement("link");
  link.rel="stylesheet"; link.href="/css/consent-manager.css";
  document.head.append(link);
  try {
    if (!window.Project318Consent) await script("consent-manager");
    if (!window.Project318Attribution) await script("marketing-attribution");
    await Promise.all([script("ga4-provider"),script("meta-pixel-provider")]);
    await script("analytics-events");
  } catch (error) { console.error("Privacy and measurement tools unavailable.",error.message); }
})();
