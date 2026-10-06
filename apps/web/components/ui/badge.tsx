import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: "brand" | "success" | "muted" | "danger";
}

export function Badge({ children, tone = "muted" }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[`badge-${tone}`]}`}>
      {children}
    </span>
  );
}
