"use client";

import { useEffect, useRef, useState } from "react";
import { BotAgentAvatar } from "@/components/bot-agent-avatar";
import { buildHumanSpeechDelivery } from "@/lib/voice-agent/human-speech-delivery";
import { runXaiVoiceAgent } from "@/lib/voice-agent/run-xai-voice-agent";

type Props = {
  token: string | null;
  botName?: string | null;
  botId?: string | null;
};

type AgentStatus = "connecting" | "connected" | "speaking" | "listening" | "error";

const DEFAULT_GREETING = "";

type SessionPayload = {
  mode?: "websocket" | "webrtc";
  clientSecret?: string;
  wsUrl?: string;
  voice?: string;
  instructions?: string;
  sdp?: string;
  greeting?: string;
  displayName?: string;
  teamLabel?: string;
  outputGain?: number;
  error?: string;
};

function sendExactSpeech(
  dc: RTCDataChannel,
  text: string,
  options?: { introduction?: boolean },
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const delivery = buildHumanSpeechDelivery(trimmed, {
    introduction: options?.introduction,
  });
  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions: delivery,
      },
    }),
  );
}

function sendGreeting(dc: RTCDataChannel, greeting: string) {
  sendExactSpeech(dc, greeting, { introduction: true });
}

function isPeerActive(pc: RTCPeerConnection | null, disposed: boolean): pc is RTCPeerConnection {
  return Boolean(pc && !disposed && pc.signalingState !== "closed");
}

type SpeakFn = (text: string, onDone?: () => void) => boolean;

export function VoiceAgentClient({ token, botName, botId }: Props) {
  const [status, setStatus] = useState<AgentStatus>("connecting");
  const [detail, setDetail] = useState("Starting voice agent…");
  const [displayName, setDisplayName] = useState("Jerome");
  const [teamLabel, setTeamLabel] = useState("AdMob");
  const speakRef = useRef<SpeakFn>(() => false);
  const agentReadyRef = useRef(false);
  const pendingAckRef = useRef<string | null>(null);

  useEffect(() => {
    agentReadyRef.current =
      status === "connected" ||
      status === "listening" ||
      status === "speaking";
  }, [status]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function ackDelivered(id: string) {
      const params = new URLSearchParams({
        token: token ?? "",
      });
      if (botId?.trim()) params.set("botId", botId.trim());
      if (botName?.trim()) params.set("botName", botName.trim());

      await fetch(`/api/voice-agent/speech-queue?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveredIds: [id] }),
      });
    }

    async function pollSpeechQueue() {
      if (!agentReadyRef.current || pendingAckRef.current) return;
      try {
        const params = new URLSearchParams({
          token: token ?? "",
        });
        if (botId?.trim()) params.set("botId", botId.trim());
        if (botName?.trim()) params.set("botName", botName.trim());

        const res = await fetch(`/api/voice-agent/speech-queue?${params}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          items?: { id?: string; text?: string }[];
        };
        const item = data.items?.[0];
        if (!item?.id || !item.text?.trim() || cancelled) return;

        const spoke = speakRef.current(item.text, () => {
          pendingAckRef.current = null;
          void ackDelivered(item.id!);
        });
        if (spoke) {
          pendingAckRef.current = item.id;
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    void pollSpeechQueue();
    const id = window.setInterval(() => void pollSpeechQueue(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [botId, botName, token]);

  useEffect(() => {
    let disposed = false;
    let cleanupXai: (() => void) | null = null;
    let pc: RTCPeerConnection | null = null;
    let mediaStream: MediaStream | null = null;
    let dataChannel: RTCDataChannel | null = null;
    let greetingSent = false;
    let greetingText = DEFAULT_GREETING;
    let outputGain = 2.5;
    let webrtcAudioContext: AudioContext | null = null;

    let webrtcSpeechDone: (() => void) | null = null;

    speakRef.current = (text: string, onDone?: () => void) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (dataChannel?.readyState === "open") {
        webrtcSpeechDone = onDone ?? null;
        sendExactSpeech(dataChannel, trimmed);
        safe.setStatus("speaking");
        safe.setDetail("Speaking in the meeting…");
        return true;
      }
      return false;
    };

    const safe = {
      setStatus: (value: AgentStatus) => {
        if (!disposed) setStatus(value);
      },
      setDetail: (value: string) => {
        if (!disposed) setDetail(value);
      },
      setDisplayName: (value: string) => {
        if (!disposed) setDisplayName(value);
      },
      setTeamLabel: (value: string) => {
        if (!disposed) setTeamLabel(value);
      },
    };

    function applySessionMeta(session: SessionPayload) {
      greetingText = session.greeting?.trim() || DEFAULT_GREETING;
      if (session.displayName) safe.setDisplayName(session.displayName);
      if (session.teamLabel) safe.setTeamLabel(session.teamLabel);
      if (typeof session.outputGain === "number" && session.outputGain > 0) {
        outputGain = session.outputGain;
      }
    }

    function boostRemoteAudio(stream: MediaStream) {
      webrtcAudioContext = new AudioContext();
      const source = webrtcAudioContext.createMediaStreamSource(stream);
      const gain = webrtcAudioContext.createGain();
      gain.gain.value = outputGain;
      source.connect(gain);
      gain.connect(webrtcAudioContext.destination);
      void webrtcAudioContext.resume().catch(() => {});
    }

    function maybeSendGreeting() {
      if (
        greetingSent ||
        !dataChannel ||
        dataChannel.readyState !== "open" ||
        !isPeerActive(pc, disposed)
      ) {
        return;
      }
      greetingSent = true;
      if (!greetingText.trim()) {
        safe.setStatus("listening");
        safe.setDetail("Live — ready when you click Speak now.");
        return;
      }
      sendGreeting(dataChannel, greetingText);
      safe.setStatus("connected");
      safe.setDetail("Speaking in the meeting…");
    }

    async function connectWebRtc(offerSdp: string) {
      safe.setDetail("Starting OpenAI Realtime session…");
      const sessionRes = await fetch("/api/voice-agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, botName, sdp: offerSdp }),
      });

      if (!isPeerActive(pc, disposed)) return;

      const session = (await sessionRes.json()) as SessionPayload;
      if (!sessionRes.ok) {
        throw new Error(session.error || `Session failed (${sessionRes.status})`);
      }

      applySessionMeta(session);
      if (!session.sdp) {
        throw new Error("Realtime API did not return an SDP answer.");
      }

      if (!isPeerActive(pc, disposed)) return;
      await pc!.setRemoteDescription({ type: "answer", sdp: session.sdp });
      maybeSendGreeting();
    }

    async function connectOpenAiWebRtc() {
      safe.setDetail("Connecting to meeting audio…");
      pc = new RTCPeerConnection();

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          boostRemoteAudio(stream);
        }
      };

      dataChannel = pc.createDataChannel("oai-events");
      dataChannel.onopen = () => maybeSendGreeting();
      dataChannel.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            error?: { message?: string };
          };
          if (msg.type === "error") {
            safe.setStatus("error");
            safe.setDetail(msg.error?.message ?? "OpenAI Realtime error");
            return;
          }
          if (msg.type === "session.updated") maybeSendGreeting();
          if (msg.type === "response.created") {
            safe.setStatus("speaking");
            safe.setDetail("Speaking in the meeting…");
          }
          if (msg.type === "response.done") {
            webrtcSpeechDone?.();
            webrtcSpeechDone = null;
            safe.setStatus("listening");
            safe.setDetail("Listening — ask Jerome a question.");
          }
        } catch {
          /* ignore */
        }
      };

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isPeerActive(pc, disposed)) return;

      for (const track of mediaStream.getAudioTracks()) {
        pc.addTrack(track, mediaStream);
      }

      const offer = await pc.createOffer();
      if (!isPeerActive(pc, disposed)) return;
      await pc.setLocalDescription(offer);
      if (!isPeerActive(pc, disposed)) return;

      await connectWebRtc(offer.sdp ?? "");
    }

    async function connect() {
      try {
        safe.setDetail("Starting voice session…");
        const probeRes = await fetch("/api/voice-agent/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, botName }),
        });

        const probe = (await probeRes.json()) as SessionPayload;

        if (probeRes.ok && probe.mode === "websocket") {
          applySessionMeta(probe);
          if (!probe.clientSecret || !probe.wsUrl) {
            throw new Error("Grok Voice session missing connection details.");
          }

          const controls = runXaiVoiceAgent({
            wsUrl: probe.wsUrl,
            clientSecret: probe.clientSecret,
            voice: probe.voice ?? "leo",
            instructions: probe.instructions ?? "",
            greeting: greetingText,
            outputGain: probe.outputGain ?? outputGain,
            onStatus: safe.setStatus,
            onDetail: safe.setDetail,
            isDisposed: () => disposed,
          });
          speakRef.current = controls.speak;
          cleanupXai = controls.dispose;
          return;
        }

        if (probeRes.status !== 400) {
          throw new Error(probe.error || `Session failed (${probeRes.status})`);
        }

        await connectOpenAiWebRtc();
      } catch (err) {
        if (disposed) return;
        console.error("[voice-agent]", err);
        safe.setStatus("error");
        safe.setDetail(err instanceof Error ? err.message : "Connection failed");
      }
    }

    void connect();

    return () => {
      disposed = true;
      cleanupXai?.();
      dataChannel?.close();
      pc?.close();
      mediaStream?.getTracks().forEach((t) => t.stop());
      void webrtcAudioContext?.close();
    };
  }, [token, botName]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <BotAgentAvatar
        alt={`${displayName} avatar`}
        variant="full"
        speaking={status === "speaking"}
        error={status === "error"}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-16 text-center">
        <p className="text-lg font-semibold tracking-tight">{displayName}</p>
        <p className="mt-0.5 text-sm text-white/60">{teamLabel}</p>
        {status === "error" && (
          <p className="mx-auto mt-3 max-w-md text-sm text-red-300">{detail}</p>
        )}
      </div>
    </div>
  );
}
