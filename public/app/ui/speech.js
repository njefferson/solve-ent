/**
 * speech.ts — reading a question aloud.
 *
 * ## Synthesis is allowed. RECOGNITION IS NOT, and it is named here so that
 * refusing it is a fact about this file rather than an intention.
 *
 * `speechSynthesis` and `SpeechRecognition` (and `webkitSpeechRecognition`) are
 * one letter apart in the same corner of the platform, and reaching for the
 * wrong one turns on a microphone in a room full of children. Nothing in this
 * application may construct, reference or feature-detect either recogniser.
 * There is no toggle for it, no setting that would enable it, and no code path
 * that would need one.
 *
 * ## What may be spoken
 *
 * The QUESTION, and the step being asked. Never the answer, never an
 * intermediate value, never the diagnosis before the attempt at that step.
 * Reading a question aloud is reading the question; a read-aloud that reached
 * the answer would be the same disclosure through a different channel, and the
 * rule does not stop applying because the delivery is audio.
 *
 * `speak` therefore takes text a caller has already decided is showable, and
 * the caller is the screen — which only ever holds a `Problem`, a type that
 * carries no answer and no intermediate. The wall is the type, here as
 * everywhere else.
 */
/** True where this device can speak at all. */
export function canSpeak() {
    return typeof globalThis.speechSynthesis !== 'undefined';
}
/**
 * The device's voice, or null where there is none.
 *
 * Null is a normal answer. The read-aloud control is not offered at all where
 * this returns null, rather than offered and then silently doing nothing —
 * a control that does nothing teaches a reader that the app is broken, and
 * they are not wrong.
 */
export function deviceVoice() {
    if (!canSpeak())
        return null;
    const engine = globalThis.speechSynthesis;
    return {
        speak(text) {
            // Cancel first. Two utterances queued behind each other is a reader
            // pressing the button again because nothing seemed to happen, and then
            // waiting through both.
            engine.cancel();
            const utterance = new globalThis.SpeechSynthesisUtterance(text);
            // Slower than the default, which is tuned for prose rather than for a
            // sentence with three numbers and a unit in it.
            utterance.rate = 0.9;
            engine.speak(utterance);
        },
        stop() {
            engine.cancel();
        },
    };
}
