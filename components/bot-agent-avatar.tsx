import { BOT_AGENT_LOGO_PATH } from "@/lib/bot/bot-agent-logo";

type Props = {
  alt?: string;
  /** full = fills Meet camera tile with logo on black */
  variant?: "full" | "compact";
  speaking?: boolean;
  error?: boolean;
};

export function BotAgentAvatar({
  alt = "Bot avatar",
  variant = "full",
  speaking = false,
  error = false,
}: Props) {
  if (variant === "full") {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        <img
          src={BOT_AGENT_LOGO_PATH}
          alt={alt}
          className={`h-[min(58vh,58vw)] w-[min(58vh,58vw)] object-contain ${
            speaking ? "animate-pulse" : ""
          }`}
        />
        {error && (
          <span className="absolute bottom-6 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white">
            Connection error
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-black p-3 ${
        speaking
          ? "ring-2 ring-sky-400/80"
          : error
            ? "ring-2 ring-red-400/80"
            : "ring-2 ring-white/20"
      }`}
    >
      <img
        src={BOT_AGENT_LOGO_PATH}
        alt={alt}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
