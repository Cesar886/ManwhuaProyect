'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import Header from '@/components/Header';

export default function ChapterReaderLayout({ children, colorScheme, toggleColorScheme }) {
  return (
    <AppLayout headerVariant="hidden" showFooter={false}>
      <Header colorScheme={colorScheme} toggleColorScheme={toggleColorScheme} />
      {children}
    </AppLayout>
  );
}