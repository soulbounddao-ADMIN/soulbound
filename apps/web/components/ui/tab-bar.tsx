"use client";

import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly badge?: string;
}

interface TabBarProps<T extends string> {
  readonly label: string;
  readonly items: readonly TabItem<T>[];
  readonly activeId: T;
  readonly onChange: (id: T) => void;
  readonly orientation?: "horizontal" | "vertical";
}

export function TabBar<T extends string>({
  label,
  items,
  activeId,
  onChange,
  orientation = "horizontal",
}: TabBarProps<T>) {
  return (
    <nav
      aria-label={label}
      aria-orientation={orientation}
      className={styles.tabBar}
      data-orientation={orientation}
      role="tablist"
      style={{ "--tab-count": items.length } as React.CSSProperties}
    >
      {items.map((item) => (
        <button
          aria-selected={activeId === item.id}
          className={activeId === item.id ? styles.tabActive : undefined}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
          <span className={styles.tabLabel}>{item.label}</span>
          {item.badge ? (
            <span aria-hidden="true" className={styles.tabBadge}>
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
