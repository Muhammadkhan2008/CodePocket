window.CodePocketAPI.UI.setHeaderWidget(`<span id="clock-widget" style="font-family:var(--font-code); color:var(--accent); font-weight:bold;">00:00:00</span>`);
setInterval(() => {
  const el = document.getElementById("clock-widget");
  if(el) el.innerText = new Date().toLocaleTimeString();
}, 1000);
window.CodePocketAPI.print("Live Clock widget injected into header!", "system");
