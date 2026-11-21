'use client';

import { Tooltip } from '@mantine/core';
import styles from './AnonymousAvatar.module.css';

export default function AnonymousAvatar({ size = 40 }) {
  return (
    <Tooltip label="Lector anónimo" withArrow position="top">
      <span
        className={styles.avatar}
        style={{ '--anonymous-avatar-size': `${size}px` }}
        aria-label="Lector anónimo"
      >
        AN
      </span>
    </Tooltip>
  );
}
