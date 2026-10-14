/* No third-party iframe. The Gaussian Garden and robot now share the
   first-party PlayCanvas rendering scene at /robot-garden. */
'use strict';
(() => {
  const garden=document.getElementById('view-garden');
  const map=document.getElementById('view2d');
  if(!garden||!map) return;
  garden.addEventListener('click',()=>window.location.assign('/robot-garden'));
  const view=new URLSearchParams(window.location.search).get('view');
  if(view==='map') map.click();
  else if(view!=='campus') window.location.replace('/robot-garden');
})();
