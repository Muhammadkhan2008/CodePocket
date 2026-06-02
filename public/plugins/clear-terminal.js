window.CodePocketAPI.Commands.register("clear-term", "Clear Terminal Output", () => {
  document.getElementById("terminal-output").innerHTML = "";
  window.CodePocketAPI.print("Terminal cleared by Plugin.", "success");
});
window.CodePocketAPI.print("Clear Terminal Tool added to Command Palette!", "system");
