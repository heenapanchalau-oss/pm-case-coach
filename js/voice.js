/* Voice input (speech-to-text) and read-aloud, using the browser's built-in Web Speech API.
   Runs locally in the browser; falls back to typing where unsupported. */
(function (root) {
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  let active = null;

  function supported() { return !!SR; }

  /* Wire a mic button to a text field. Speech is appended to whatever is already typed. */
  function attachMic(button, field, lang) {
    if (!SR) { button.hidden = true; return; }
    button.addEventListener("click", () => {
      if (active && active.button === button) { active.rec.stop(); return; }
      if (active) active.rec.stop();
      const rec = new SR();
      rec.lang = lang || document.documentElement.lang || "en-AU";
      rec.interimResults = true;
      rec.continuous = true;
      const base = field.value ? field.value.replace(/\s*$/, " ") : "";
      let finalText = "";
      rec.onresult = e => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
          else interim += e.results[i][0].transcript;
        }
        field.value = (base + finalText + interim).trimStart();
        field.dispatchEvent(new Event("input"));
      };
      rec.onend = () => { button.classList.remove("listening"); button.setAttribute("aria-pressed", "false"); if (active && active.rec === rec) active = null; };
      rec.onerror = () => rec.onend();
      active = { rec, button };
      button.classList.add("listening"); button.setAttribute("aria-pressed", "true");
      rec.start();
    });
  }

  function speak(text, on) {
    if (!on || !root.speechSynthesis) return;
    root.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-AU"; u.rate = 1;
    root.speechSynthesis.speak(u);
  }
  function stopSpeaking() { if (root.speechSynthesis) root.speechSynthesis.cancel(); }

  root.Voice = { supported, attachMic, speak, stopSpeaking };
})(window);
