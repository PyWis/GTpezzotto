/** Speech bubbles: any entity with { say, sayT } can talk. */
export function say(entity, text, seconds = 1.6) {
  entity.say = text;
  entity.sayT = seconds;
}

export function tickSpeech(entity, dt) {
  if (entity.sayT > 0) entity.sayT -= dt;
}

export const isTalking = (entity) => entity.sayT > 0;
