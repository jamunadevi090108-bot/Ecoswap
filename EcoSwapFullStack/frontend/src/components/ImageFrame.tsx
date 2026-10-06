import { useState } from 'react';

type ImageFrameProps = {
  src?: string;
  alt: string;
  className?: string;
};

export default function ImageFrame({ src, alt, className = '' }: ImageFrameProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`product-image-frame ${className}`} role="img" aria-label={failed || !src ? `${alt}: image unavailable` : alt}>
      {src && !failed
        ? <img src={src} alt={alt} onError={() => setFailed(true)} />
        : <span>Image unavailable</span>}
    </div>
  );
}
