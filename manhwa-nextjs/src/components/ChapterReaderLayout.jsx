'use client';

import React from 'react';
import AppLayout from '../../components/AppLayout';
import HeaderRead from '../../components/HeaderRead';

export default function ChapterReaderLayout({ children, colorScheme, toggleColorScheme }) {
  return (
    <AppLayout headerVariant="hidden" showFooter={false}>
      <HeaderRead colorScheme={colorScheme} toggleColorScheme={toggleColorScheme} />
      {children}
    </AppLayout>
  );
}