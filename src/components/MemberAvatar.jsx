import { useState } from 'react';
import { cloudinaryThumb } from '../lib/cloudinary';
import { getInitials } from '../utils/format';

/**
 * Round member avatar: Cloudinary profile photo when available, initials otherwise.
 * size: 'sm' | 'md' | 'lg' | 'xl'   (pixel size used to request a sharp thumbnail)
 */
const PIXELS = { sm: 34, md: 40, lg: 68, xl: 132 };

export default function MemberAvatar({ name = '', photoUrl, size = 'md', showStatus = false }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showPhoto = photoUrl && failedUrl !== photoUrl;
  const px = PIXELS[size] || PIXELS.md;

  return (
    <span className={`avatar avatar-${size} ${showPhoto ? 'has-photo' : ''}`} aria-hidden="true">
      {showPhoto ? (
        <img src={cloudinaryThumb(photoUrl, px * 2)} alt="" loading="lazy" onError={() => setFailedUrl(photoUrl)} />
      ) : (
        getInitials(name)
      )}
      {showStatus && <span className="avatar-status" />}
    </span>
  );
}
