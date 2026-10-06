import React, { useId, type ReactNode } from "react";
import styles from "./ui.module.css";

interface SectionProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Section({
  title,
  description,
  action,
  className,
  children,
}: SectionProps) {
  const headingId = useId();

  return (
    <section
      className={[styles.section, className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
    >
      <div className={styles.sectionHeader}>
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
