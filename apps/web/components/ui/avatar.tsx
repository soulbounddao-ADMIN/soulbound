import React from "react";
import styles from "./ui.module.css";

interface AvatarProps {
  readonly label: string;
  readonly tone?: "brand" | "quiet" | "success";
}

export function Avatar({ label, tone = "brand" }: AvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[`avatar-${tone}`]}`}>
      {label}
    </span>
  );
}
