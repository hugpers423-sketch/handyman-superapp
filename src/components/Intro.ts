export function renderIntro(): string {
  return `
    <div class="intro" role="dialog" aria-label="Introducción" aria-modal="true">
      <div class="intro-logo">
        <div class="intro-mark" aria-hidden="true">H</div>
        <span>HANDYMAN</span>
      </div>
      <div class="intro-copy">
        <div class="mini">SUPER APP</div>
        <h1>Cualquier problema.<br><i>Una sola app.</i></h1>
        <p>Conecta en minutos con profesionales verificados para tu hogar, negocio o empresa. Seguimiento en vivo y garantía incluida.</p>
      </div>
      <div class="intro-foot">
        <span>Lima, Perú</span>
        <div class="intro-line"><i></i></div>
        <span>v1.0.0</span>
      </div>
      <button class="intro-skip" aria-label="Omitir introducción">OMITIR INTRO →</button>
    </div>
  `;
}