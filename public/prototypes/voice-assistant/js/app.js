import { VoiceAssistantApp } from "./VoiceAssistantApp.js";

const app = new VoiceAssistantApp();
app.init().catch((error) => {
  console.error("Voice assistant preview failed to initialize", error);
});

globalThis.voiceAssistantPreview = app;
