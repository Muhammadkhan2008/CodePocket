window.CodePocketAPI.Commands.register("uppercase-all", "Convert Code to UPPERCASE", () => {
  const code = window.CodePocketAPI.getCode();
  window.CodePocketAPI.setCode(code.toUpperCase());
  window.CodePocketAPI.print("Code converted to uppercase!", "system");
});
window.CodePocketAPI.print("Uppercase Tool added to Command Palette!", "system");
