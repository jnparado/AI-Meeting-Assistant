import {
  XAI_PCM_SAMPLE_RATE,
  base64Pcm16ToFloat32,
  float32ToPcm16Base64,
  resampleFloat32,
} from "@/lib/voice-agent/audio-pcm";

const CHUNK_MS = 100;

type Status = "connecting" | "connected" | "speaking" | "listening" | "error";

type Params = {
  wsUrl: string;
  clientSecret: string;
  voice: string;
  instructions: string;
  greeting: string;
  onStatus: (status: Status) => void;
  onDetail: (detail: string) => void;
  isDisposed: () => boolean;
};

export function runXaiVoiceAgent(params: Params): () => void {
  const {
    wsUrl,
    clientSecret,
    voice,
    instructions,
    greeting,
    onStatus,
    onDetail,
    isDisposed,
  } = params;

  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let sessionReady = false;
  let greetingSent = false;
  let playbackQueue: Float32Array[] = [];
  let playing = false;
  let currentSource: AudioBufferSourceNode | null = null;
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
    node.connect(audioContext.destination);
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

  function sendGreeting() {
    if (!ws || ws.readyState !== WebSocket.OPEN || greetingSent) return;
    greetingSent = true;
    ws.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: `Say this greeting exactly, then pause and listen: "${greeting}"`,
        },
      }),
    );
    onStatus("connected");
    onDetail("Live — introducing himself…");
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
          turn_detection: { type: "server_vad" },
        },
      }),
    );
  }

  async function start() {
    try {
      onDetail("Connecting to meeting audio…");
      audioContext = new AudioContext({ sampleRate: XAI_PCM_SAMPLE_RATE });
      captureRate = audioContext.sampleRate;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

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
      ws = new WebSocket(wsUrl, [`xai-client-secret.${clientSecret}`]);

      ws.onopen = () => {
        if (isDisposed()) return;
        onDetail("Starting Grok Voice session…");
      };

      ws.onmessage = (event) => {
        if (isDisposed()) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            delta?: string;
            error?: { message?: string };
          };

          if (msg.type === "error") {
            onStatus("error");
            onDetail(msg.error?.message ?? "Grok Voice error");
            return;
          }

          if (
            (msg.type === "conversation.created" ||
              msg.type === "session.created") &&
            !sessionReady
          ) {
            configureSession();
          }

          if (msg.type === "session.updated" && !sessionReady) {
            sessionReady = true;
            startMicCapture();
            sendGreeting();
          }

          if (
            msg.type === "response.output_audio.delta" ||
            msg.type === "response.audio.delta"
          ) {
            if (msg.delta) playAudio(msg.delta);
            onStatus("speaking");
            onDetail("Speaking in the meeting…");
          }

          if (msg.type === "input_audio_buffer.speech_started") {
            stopPlayback();
          }

          if (msg.type === "response.done") {
            onStatus("listening");
            onDetail("Listening — ask John a question.");
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

      ws.onclose = () => {
        if (!isDisposed() && !greetingSent) {
          onStatus("error");
          onDetail("Grok Voice connection closed");
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
    processor.connect(audioContext.destination);
  }

  void start();

  return () => {
    stopPlayback();
    processor?.disconnect();
    source?.disconnect();
    mediaStream?.getTracks().forEach((t) => t.stop());
    ws?.close();
    void audioContext?.close();
  };
}
