/* Genuine Gaussian Splat viewer in an independent, attributed visual mode.
   This cross-origin frame cannot share coordinates with the CDR planner or Gazebo. */
'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const gardenButton = byId('view-garden');
  const garden = byId('garden-splat');
  const frame = byId('garden-frame');
  const disclosure = byId('garden-disclosure');
  const campus3d = byId('scene3d');
  const map2d = byId('map');
  const stage = byId('stage-viewport');
  const panel = byId('mission-studio');
  const view3d = byId('view3d');
  const view2d = byId('view2d');
  const title = panel?.querySelector('.panel-top h2');
  const kicker = panel?.querySelector('.panel-kicker');
  if (![gardenButton, garden, frame, disclosure, campus3d, map2d, stage, panel, view3d, view2d].every(Boolean)) return;

  function exitGarden() {
    stage.classList.remove('garden-active');
    panel.classList.remove('garden-selected');
    document.body.classList.remove('garden-mode');
    if (title) title.textContent = 'Campus mission simulation';
    if (kicker) kicker.textContent = '01 / IMMERSIVE MISSION STUDIO';
    gardenButton.setAttribute('aria-pressed', 'false');
    disclosure.hidden = true;
    // The existing scene3d.js handlers remain authoritative for 3D/2D switching.
    // No planner or robot simulation state is changed when leaving the garden.
  }

  gardenButton.addEventListener('click', () => {
    if (!frame.getAttribute('src')) {
      // Real SuperSplat scene, loaded on demand to avoid wasting bandwidth.
      frame.setAttribute('src', frame.dataset.src);
    }
    stage.classList.add('garden-active', 'show3d');
    panel.classList.add('garden-selected');
    document.body.classList.add('garden-mode');
    if (title) title.textContent = 'The real Garden, reconstructed in 3D';
    if (kicker) kicker.textContent = '01 / PHOTOREAL FIELD ENVIRONMENT · VISUAL PREVIEW';
    campus3d.hidden = true;
    map2d.hidden = true;
    gardenButton.setAttribute('aria-pressed', 'true');
    view3d.setAttribute('aria-pressed', 'false');
    view2d.setAttribute('aria-pressed', 'false');
    disclosure.hidden = false;
  });
  view3d.addEventListener('click', exitGarden);
  view2d.addEventListener('click', exitGarden);
  // Use ?view=campus for the original engineering dashboard, ?view=map for 2D.
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (requestedView === 'map') view2d.click();
  else if (requestedView !== 'campus') gardenButton.click();
})();
