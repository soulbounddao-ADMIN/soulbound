import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import styles from "./ui.module.css";

type CardProps = {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly tone?: "plain" | "warm" | "sunken";
} & ComponentPropsWithoutRef<"section">;

export function Card({
  children,
  className,
  tone = "plain",
  ...props
}: CardProps) {
  return (
    <section
      className={[styles.card, styles[`card-${tone}`], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </section>
  );
}
