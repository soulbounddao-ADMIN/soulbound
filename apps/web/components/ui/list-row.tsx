import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface ListRowProps {
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
}

export function ListRow({
  leading,
  title,
  description,
  meta,
  trailing,
}: ListRowProps) {
  return (
    <div className={styles.listRow}>
      {leading ? <div className={styles.listLeading}>{leading}</div> : null}
      <div className={styles.listBody}>
        <div className={styles.listTitle}>{title}</div>
        {description ? (
          <div className={styles.listDescription}>{description}</div>
        ) : null}
        {meta ? <div className={styles.listMeta}>{meta}</div> : null}
      </div>
      {trailing ? <div className={styles.listTrailing}>{trailing}</div> : null}
    </div>
  );
}
