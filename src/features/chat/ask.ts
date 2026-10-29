/** Opens the reports chat with a question already typed (from a profile, the map, etc.). */
export const ASK_EVENT = "penguin-chat:ask";

export function askChat(question: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: question }));
}
