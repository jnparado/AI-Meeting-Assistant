"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const authInputShell =
  "flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-input bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40";

export const authInputInner =
  "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm";

type AuthTextFieldProps = React.ComponentProps<"input"> & {
  leadingIcon?: React.ReactNode;
};

export function AuthTextField({
  className,
  leadingIcon,
  ...props
}: AuthTextFieldProps) {
  return (
    <div className={cn(authInputShell, className)}>
      {leadingIcon ? (
        <span className="flex shrink-0 text-muted-foreground">{leadingIcon}</span>
      ) : null}
      <input className={authInputInner} {...props} />
    </div>
  );
}

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  leadingIcon?: React.ReactNode;
};

export function PasswordInput({
  className,
  id,
  leadingIcon,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn(authInputShell, "pr-1.5", className)}>
      {leadingIcon ? (
        <span className="flex shrink-0 text-muted-foreground">{leadingIcon}</span>
      ) : null}
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={authInputInner}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
