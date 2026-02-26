"use client";

import { useRef, useEffect, memo } from 'react';
import { decode } from 'blurhash';

const DECODE_SIZE = 32;

function BlurhashCanvas({ blurhash, width, height, style }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !blurhash) return;

    try {
      const pixels = decode(blurhash, DECODE_SIZE, DECODE_SIZE);
      const ctx = canvasRef.current.getContext('2d');
      const imageData = ctx.createImageData(DECODE_SIZE, DECODE_SIZE);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Blurhash inválido — dejar canvas vacío
    }
  }, [blurhash]);

  return (
    <canvas
      ref={canvasRef}
      width={DECODE_SIZE}
      height={DECODE_SIZE}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
}

export default memo(BlurhashCanvas);
