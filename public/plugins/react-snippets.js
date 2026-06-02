window.CodePocketAPI.Commands.register("react-snippet", "Insert React Component", () => {
  const code = `import React from 'react';

export default function Component() {
  return (
    <div className="container">
      <h1>Hello from React Snippets Plugin!</h1>
    </div>
  );
}
`;
  window.CodePocketAPI.setCode(code);
  window.CodePocketAPI.print("React Component Snippet injected into editor!", "success");
});
window.CodePocketAPI.print("React Snippets added to Command Palette!", "system");
