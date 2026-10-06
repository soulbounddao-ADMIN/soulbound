import Link from "next/link";
import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import styles from "./ui.module.css";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost";

interface ButtonBaseProps {
  readonly children: ReactNode;
  readonly tone?: ButtonTone;
  readonly className?: string | undefined;
}

type ButtonProps = ButtonBaseProps & ComponentPropsWithoutRef<"button">;

type LinkButtonProps = ButtonBaseProps & ComponentPropsWithoutRef<typeof Link>;

function classNames(tone: ButtonTone, className?: string): string {
  return [styles.button, styles[`button-${tone}`], className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  tone = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={classNames(tone, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  tone = "primary",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={classNames(tone, className)} {...props}>
      {children}
    </Link>
  );
}
