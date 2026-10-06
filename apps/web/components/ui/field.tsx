import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface FieldProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
