"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  token: string | null;
  botName?: string | null;
};

type AgentStatus = "connecting" | "connected" | "speaking" | "listening" | "error";

const DEFAULT_GREETING =
  "Hi, my name is John from the AdSense team. Nice to meet you.";

function sendGreeting(dc: RTCDataChannel, greeting: string) {
  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions: `Say this greeting exactly, then pause and listen for others in the meeting: "${greeting}"`,
      },
    }),
  );
}

export function VoiceAgentClient({ token, botName }: Props) {
  const [status, setStatus] = useState<AgentStatus>("connecting");
  const [detail, setDetail] = useState("Starting voice agent…");
  const [displayName, setDisplayName] = useState("John");
  const [teamLabel, setTeamLabel] = useState("AdSense team");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let pc: RTCPeerConnection | null = null;
    let mediaStream: MediaStream | null = null;
    let audioEl: HTMLAudioElement | null = null;
    let dataChannel: RTCDataChannel | null = null;
    let greetingSent = false;
    let greetingText = DEFAULT_GREETING;

    function maybeSendGreeting() {
      if (greetingSent || !dataChannel || dataChannel.readyState !== "open") {
        return;
      }
      greetingSent = true;
      sendGreeting(dataChannel, greetingText);
      setStatus("connected");
      setDetail("Live — introducing himself…");
    }

    async function connect() {
      try {
        setDetail("Connecting to meeting audio…");
        pc = new RTCPeerConnection();

        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        audioEl.volume = 1;
        document.body.appendChild(audioEl);

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (stream && audioEl) {
            audioEl.srcObject = stream;
            void audioEl.play().catch(() => {
              /* Recall browser usually allows autoplay */
            });
          }
        };

        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        for (const track of mediaStream.getAudioTracks()) {
          pc.addTrack(track, mediaStream);
        }

        dataChannel = pc.createDataChannel("oai-events");
        dataChannel.onopen = () => {
          maybeSendGreeting();
        };
        dataChannel.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data)) as {
              type?: string;
              error?: { message?: string };
            };
            if (msg.type === "error") {
              console.error("[voice-agent]", msg);
              setDetail(msg.error?.message ?? "OpenAI Realtime error");
              return;
            }
            if (msg.type === "session.updated") {
              maybeSendGreeting();
            }
            if (msg.type === "response.created") {
              setStatus("speaking");
              setDetail("Speaking in the meeting…");
            }
            if (msg.type === "response.done") {
              setStatus("listening");
              setDetail("Listening — ask John a question.");
            }
          } catch {
            /* ignore non-JSON */
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        setDetail("Starting OpenAI Realtime session…");
        const sessionRes = await fetch("/api/voice-agent/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            botName,
            sdp: offer.sdp,
          }),
        });

        if (!sessionRes.ok) {
          const err = await sessionRes.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ||
              `Session failed (${sessionRes.status})`,
          );
        }

        const session = (await sessionRes.json()) as {
          sdp?: string;
          greeting?: string;
          displayName?: string;
          teamLabel?: string;
        };

        greetingText = session.greeting?.trim() || DEFAULT_GREETING;
        if (session.displayName) setDisplayName(session.displayName);
        if (session.teamLabel) setTeamLabel(session.teamLabel);

        if (!session.sdp) {
          throw new Error("OpenAI did not return an SDP answer.");
        }

        await pc.setRemoteDescription({ type: "answer", sdp: session.sdp });
        maybeSendGreeting();
      } catch (err) {
        console.error("[voice-agent]", err);
        setStatus("error");
        setDetail(err instanceof Error ? err.message : "Connection failed");
      }
    }

    void connect();

    return () => {
      dataChannel?.close();
      pc?.close();
      mediaStream?.getTracks().forEach((t) => t.stop());
      audioEl?.remove();
    };
  }, [token, botName]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[#0f1115] text-white">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight">{displayName}</p>
        <p className="mt-1 text-sm text-white/60">{teamLabel}</p>
      </div>

      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-2 ${
          status === "speaking"
            ? "border-sky-400/80 bg-sky-500/10 animate-pulse"
            : status === "listening" || status === "connected"
              ? "border-emerald-400/80 bg-emerald-500/10"
              : status === "error"
                ? "border-red-400/80 bg-red-500/10"
                : "border-white/30 bg-white/5"
        }`}
      >
        <span className="text-3xl" aria-hidden>
          {status === "speaking"
            ? "🎙"
            : status === "listening" || status === "connected"
              ? "👂"
              : status === "error"
                ? "!"
                : "…"}
        </span>
      </div>

      <p
        className={`max-w-md px-6 text-center text-sm ${
          status === "error" ? "text-red-300" : "text-white/70"
        }`}
      >
        {detail}
      </p>
    </div>
  );
}
