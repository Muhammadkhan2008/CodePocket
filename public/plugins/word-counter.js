window.CodePocketAPI.Commands.register("word-count", "Count Words & Characters", () => {
  const text = window.CodePocketAPI.getCode();
  const chars = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  window.CodePocketAPI.print(`Document Stats: ${words} words, ${chars} characters.`, "system");
});
window.CodePocketAPI.print("Word Counter Tool added to Command Palette (Ctrl+Shift+P)!", "system");
