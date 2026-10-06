import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface AppBarProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function AppBar({
  eyebrow,
  title,
  description,
  action,
}: AppBarProps) {
  return (
    <header className={styles.appBar}>
      <div className={styles.appBarText}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.appBarAction}>{action}</div> : null}
    </header>
  );
}
