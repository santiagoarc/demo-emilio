/** Abre el chat de reportes con una pregunta ya escrita (desde una ficha, el mapa, etc.). */
export const ASK_EVENT = "penguin-chat:ask";

export function askChat(question: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: question }));
}
