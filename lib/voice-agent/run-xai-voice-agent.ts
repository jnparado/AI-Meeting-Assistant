import {
  XAI_PCM_SAMPLE_RATE,
  base64Pcm16ToFloat32,
  float32ToPcm16Base64,
  resampleFloat32,
} from "@/lib/voice-agent/audio-pcm";
import { getXaiWebSocketSubprotocol } from "@/lib/voice-agent/xai-ws-protocol";

const CHUNK_MS = 100;

type Status = "connecting" | "connected" | "speaking" | "listening" | "error";

type Params = {
  wsUrl: string;
  clientSecret: string;
  voice: string;
  instructions: string;
  greeting: string;
  outputGain?: number;
  onStatus: (status: Status) => void;
  onDetail: (detail: string) => void;
  isDisposed: () => boolean;
};

export type XaiVoiceAgentControls = {
  dispose: () => void;
  speak: (text: string) => void;
};

export function runXaiVoiceAgent(params: Params): XaiVoiceAgentControls {
  const {
    wsUrl,
    clientSecret,
    voice,
    instructions,
    greeting,
    outputGain = 2.5,
    onStatus,
    onDetail,
    isDisposed,
  } = params;

  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let silentSink: GainNode | null = null;
  let sessionReady = false;
  let greetingSent = false;
  let pendingSpeech: string[] = [];
  let scriptedSpeech: { text: string; introduction?: boolean }[] = [];
  let speakingScript = false;
  let playbackQueue: Float32Array[] = [];
  let playing = false;
  let currentSource: AudioBufferSourceNode | null = null;
  let playbackGain: GainNode | null = null;
  let captureRate = XAI_PCM_SAMPLE_RATE;

  function playNext() {
    if (!audioContext || playbackQueue.length === 0) {
      playing = false;
      currentSource = null;
      return;
    }
    playing = true;
    const chunk = playbackQueue.shift()!;
    const buffer = audioContext.createBuffer(1, chunk.length, XAI_PCM_SAMPLE_RATE);
    buffer.getChannelData(0).set(chunk);
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(playbackGain ?? audioContext.destination);
    currentSource = node;
    node.onended = () => {
      if (currentSource === node) currentSource = null;
      playNext();
    };
    node.start();
  }

  function playAudio(base64: string) {
    if (!audioContext || isDisposed()) return;
    playbackQueue.push(base64Pcm16ToFloat32(base64));
    if (!playing) playNext();
  }

  function stopPlayback() {
    playbackQueue = [];
    playing = false;
    if (currentSource) {
      try {
        currentSource.stop();
        currentSource.disconnect();
      } catch {
        /* already stopped */
      }
      currentSource = null;
    }
  }

  function flushScriptedSpeech() {
    if (speakingScript || !ws || ws.readyState !== WebSocket.OPEN || !sessionReady) {
      return;
    }

    const next = scriptedSpeech.shift();
    if (!next) return;

    speakingScript = true;
    const delivery = next.introduction
      ? `Speak clearly at a confident, slightly louder volume. Say exactly: ${JSON.stringify(next.text)}`
      : `Say exactly the following words and nothing else: ${JSON.stringify(next.text)}`;
    ws.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: delivery,
        },
      }),
    );
    onStatus("speaking");
    onDetail("Speaking in the meeting…");
  }

  function speakExact(text: string, options?: { introduction?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!sessionReady) {
      pendingSpeech.push(trimmed);
      return;
    }
    scriptedSpeech.push({ text: trimmed, introduction: options?.introduction });
    flushScriptedSpeech();
  }

  function sendGreeting() {
    if (!ws || ws.readyState !== WebSocket.OPEN || greetingSent) return;
    greetingSent = true;
    speakExact(greeting, { introduction: true });
    onStatus("connected");
    onDetail("Live — introducing himself…");
  }

  function markSessionReady() {
    if (sessionReady) return;
    sessionReady = true;
    startMicCapture();
    sendGreeting();
    for (const text of pendingSpeech) {
      speakExact(text);
    }
    pendingSpeech = [];
  }

  function configureSession() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions,
          voice,
          audio: {
            input: { format: { type: "audio/pcm", rate: XAI_PCM_SAMPLE_RATE } },
            output: { format: { type: "audio/pcm", rate: XAI_PCM_SAMPLE_RATE } },
          },
          turn_detection: { type: "server_vad", silence_duration_ms: 600 },
        },
      }),
    );
  }

  async function start() {
    try {
      onDetail("Connecting to meeting audio…");
      audioContext = new AudioContext();
      captureRate = audioContext.sampleRate;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      playbackGain = audioContext.createGain();
      playbackGain.gain.value = outputGain;
      playbackGain.connect(audioContext.destination);

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (isDisposed()) return;

      onDetail("Connecting to Grok Voice…");
      ws = new WebSocket(wsUrl, [getXaiWebSocketSubprotocol(clientSecret)]);

      ws.onopen = () => {
        if (isDisposed()) return;
        onDetail("Starting Grok Voice session…");
        configureSession();
      };

      ws.onmessage = (event) => {
        if (isDisposed()) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            delta?: string;
            error?: { message?: string; code?: string };
          };

          if (msg.type === "error") {
            onStatus("error");
            onDetail(msg.error?.message ?? "Grok Voice error");
            return;
          }

          if (
            msg.type === "conversation.created" ||
            msg.type === "session.created"
          ) {
            configureSession();
          }

          if (msg.type === "session.updated") {
            markSessionReady();
          }

          if (
            msg.type === "response.output_audio.delta" ||
            msg.type === "response.audio.delta" ||
            msg.type === "response.output_audio_transcript.delta"
          ) {
            if (msg.delta && msg.type.includes("audio")) {
              playAudio(msg.delta);
            }
            onStatus("speaking");
            onDetail("Speaking in the meeting…");
          }

          if (msg.type === "input_audio_buffer.speech_started") {
            stopPlayback();
          }

          if (msg.type === "response.done") {
            speakingScript = false;
            flushScriptedSpeech();
            onStatus("listening");
            onDetail("Listening — ask Jerome a question.");
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        if (!isDisposed()) {
          onStatus("error");
          onDetail("Grok Voice WebSocket error");
        }
      };

      ws.onclose = (event) => {
        if (isDisposed()) return;
        if (!greetingSent) {
          onStatus("error");
          const reason = event.reason?.trim();
          onDetail(
            reason ||
              (event.code === 1008
                ? "Grok Voice rejected the connection (check xAI API key / voice access)."
                : `Grok Voice connection closed (${event.code}).`),
          );
        }
      };
    } catch (err) {
      if (!isDisposed()) {
        onStatus("error");
        onDetail(err instanceof Error ? err.message : "Connection failed");
      }
    }
  }

  function startMicCapture() {
    if (!audioContext || !mediaStream || !ws || processor) return;

    source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    silentSink = audioContext.createGain();
    silentSink.gain.value = 0;

    let buffers: Float32Array[] = [];
    let totalSamples = 0;
    const chunkSamples = Math.floor((XAI_PCM_SAMPLE_RATE * CHUNK_MS) / 1000);

    processor.onaudioprocess = (event) => {
      if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return;

      const input = event.inputBuffer.getChannelData(0);
      const resampled = resampleFloat32(
        new Float32Array(input),
        captureRate,
        XAI_PCM_SAMPLE_RATE,
      );
      buffers.push(resampled);
      totalSamples += resampled.length;

      while (totalSamples >= chunkSamples) {
        const chunk = new Float32Array(chunkSamples);
        let offset = 0;
        while (offset < chunkSamples && buffers.length > 0) {
          const buf = buffers[0];
          const need = chunkSamples - offset;
          if (buf.length <= need) {
            chunk.set(buf, offset);
            offset += buf.length;
            totalSamples -= buf.length;
            buffers.shift();
          } else {
            chunk.set(buf.subarray(0, need), offset);
            buffers[0] = buf.subarray(need);
            offset += need;
            totalSamples -= need;
          }
        }
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: float32ToPcm16Base64(chunk),
          }),
        );
      }
    };

    source.connect(processor);
    processor.connect(silentSink);
    silentSink.connect(audioContext.destination);
  }

  void start();

  return {
    dispose: () => {
      stopPlayback();
      playbackGain?.disconnect();
      processor?.disconnect();
      source?.disconnect();
      silentSink?.disconnect();
      mediaStream?.getTracks().forEach((t) => t.stop());
      ws?.close();
      void audioContext?.close();
    },
    speak: speakExact,
  };
}
