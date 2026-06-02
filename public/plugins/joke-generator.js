window.CodePocketAPI.Commands.register("tell-joke", "Tell a Programming Joke", () => {
  const jokes = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
    "There are 10 types of people in the world: those who understand binary, and those who don't.",
    "Why did the programmer quit his job? Because he didn't get arrays."
  ];
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  window.CodePocketAPI.print(`🤣 Joke: ${joke}`, "success");
});
window.CodePocketAPI.print("Joke Generator added to Command Palette!", "system");
