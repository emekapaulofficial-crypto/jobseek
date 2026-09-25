/* LEGACY ENTRYPOINT REPLACED.
 * The former scoring engine is intentionally retired.
 * All CV/application scoring and generation now comes from smart-cv-engine.js.
 */
(function(){
  const s=document.createElement('script');
  s.src='smart-cv-engine.js';
  s.async=false;
  document.head.appendChild(s);
})();