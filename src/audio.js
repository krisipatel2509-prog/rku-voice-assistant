import pkg from "wavefile";
const { WaveFile } = pkg;

// ─────────────────────────────────────────────────────────────
// Audio helpers bridging Twilio media streams (8 kHz μ-law) and
// Bhashini (16 kHz PCM WAV for ASR, WAV out for TTS).
// ─────────────────────────────────────────────────────────────

// Twilio sends base64 μ-law @ 8kHz. Convert a buffer of raw μ-law bytes
// into a 16 kHz PCM16 WAV (base64) suitable for Bhashini ASR.
export function mulaw8kToWav16kBase64(mulawBuffer) {
  const wav = new WaveFile();
  wav.fromScratch(1, 8000, "8m", mulawBuffer); // 8-bit μ-law container
  wav.fromMuLaw(); // -> 16-bit PCM @ 8kHz
  wav.toSampleRate(16000); // upsample for ASR
  return wav.toBase64();
}

// Convert a Bhashini WAV (any rate/bit-depth, base64) into base64 μ-law
// @ 8kHz frames ready to send back on the Twilio media stream.
export function wavBase64ToMulaw8kBase64(wavBase64) {
  const wav = new WaveFile();
  wav.fromBase64(wavBase64);
  wav.toSampleRate(8000);
  wav.toMuLaw(); // -> 8-bit μ-law
  // wav.data.samples is a Buffer/Uint8Array of μ-law bytes.
  return Buffer.from(wav.data.samples).toString("base64");
}

// Build a Twilio-safe playable WAV buffer from a base64 WAV (Sarvam/Bhashini).
// Twilio <Play> wants 16-bit PCM @ 8 kHz, and it clips the first ~150 ms of every
// clip (which eats leading consonants, e.g. "તમારે" → "મારે"). So we downsample
// with a sinc + low-pass filter (no aliasing buzz) and pad silence at start/end.
export function wavBase64ToBuffer(wavBase64) {
  try {
    const wav = new WaveFile();
    wav.fromBase64(wavBase64);
    wav.toSampleRate(8000, { method: "sinc", LPF: true }); // smooth downsample
    wav.toBitDepth("16"); // float -> PCM16

    // Pad ~250 ms lead + ~100 ms trail so Twilio's start-clip never eats a phoneme.
    const samples = wav.getSamples(false, Int16Array);
    const lead = new Int16Array(2000);
    const trail = new Int16Array(800);
    const out = new Int16Array(lead.length + samples.length + trail.length);
    out.set(lead, 0);
    out.set(samples, lead.length);
    out.set(trail, lead.length + samples.length);

    const padded = new WaveFile();
    padded.fromScratch(1, 8000, "16", out);
    return Buffer.from(padded.toBuffer());
  } catch {
    // Worst case, hand back the raw bytes (Twilio may still play a plain WAV).
    return Buffer.from(wavBase64, "base64");
  }
}
