import {
  XAI_PCM_SAMPLE_RATE,
  base64Pcm16ToFloat32,
} from "@/lib/voice-agent/audio-pcm";
import {
  buildHumanSpeechDelivery,
  TELEPROMPTER_READY_DETAIL,
} from "@/lib/voice-agent/human-speech-delivery";
import { getXaiWebSocketSubprotocol } from "@/lib/voice-agent/xai-ws-protocol";

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
  speak: (text: string, onDone?: () => void) => boolean;
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
  let audioContext: AudioContext | null = null;
  let sessionReady = false;
  let greetingSent = false;
  let pendingSpeech: { text: string; onDone?: () => void }[] = [];
  let scriptedSpeech: {
    text: string;
    introduction?: boolean;
    onDone?: () => void;
  }[] = [];
  let speakingScript = false;
  let playbackQueue: Float32Array[] = [];
  let playing = false;
  let currentSource: AudioBufferSourceNode | null = null;
  let playbackGain: GainNode | null = null;

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
    const delivery = buildHumanSpeechDelivery(next.text, {
      introduction: next.introduction,
    });
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
    currentScriptDone = next.onDone ?? null;
  }

  let currentScriptDone: (() => void) | null = null;

  function speakExact(
    text: string,
    options?: { introduction?: boolean; onDone?: () => void },
  ): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (!sessionReady) {
      pendingSpeech.push({ text: trimmed, onDone: options?.onDone });
      return true;
    }
    scriptedSpeech.push({
      text: trimmed,
      introduction: options?.introduction,
      onDone: options?.onDone,
    });
    flushScriptedSpeech();
    return true;
  }

  function sendGreeting() {
    if (!greeting.trim()) {
      greetingSent = true;
      onStatus("listening");
      onDetail(TELEPROMPTER_READY_DETAIL);
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN || greetingSent) return;
    greetingSent = true;
    speakExact(greeting, { introduction: true });
    onStatus("connected");
    onDetail("Speaking in the meeting…");
  }

  function markSessionReady() {
    if (sessionReady) return;
    sessionReady = true;
    sendGreeting();
    for (const item of pendingSpeech) {
      speakExact(item.text, { onDone: item.onDone });
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
        },
      }),
    );
  }

  async function start() {
    try {
      onDetail("Connecting to Grok Voice…");
      audioContext = new AudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      playbackGain = audioContext.createGain();
      playbackGain.gain.value = outputGain;
      playbackGain.connect(audioContext.destination);

      if (isDisposed()) return;

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
            response?: { id?: string };
            error?: { message?: string; code?: string };
          };

          if (msg.type === "response.created" && !speakingScript) {
            const responseId = msg.response?.id;
            if (responseId) {
              ws?.send(
                JSON.stringify({
                  type: "response.cancel",
                  response_id: responseId,
                }),
              );
            }
            return;
          }

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
            currentScriptDone?.();
            currentScriptDone = null;
            flushScriptedSpeech();
            onStatus("listening");
            onDetail(TELEPROMPTER_READY_DETAIL);
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

  void start();

  return {
    dispose: () => {
      stopPlayback();
      playbackGain?.disconnect();
      ws?.close();
      void audioContext?.close();
    },
    speak: (text: string, onDone?: () => void) =>
      speakExact(text, { onDone }),
  };
}
