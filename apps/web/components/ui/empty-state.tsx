import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface EmptyStateProps {
  readonly title?: string;
  readonly children: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      {title ? <h3>{title}</h3> : null}
      <p>{children}</p>
    </div>
  );
}
