import { useEffect, useRef, useState } from 'react';
import { CameraIcon, CheckIcon, CloseIcon } from './Icons';
import {
  ACCEPTED_IMAGE_TYPES,
  cloudinaryBanner,
  isCloudinaryConfigured,
  uploadImage,
  validateImage
} from '../lib/cloudinary';

/**
 * "Upload Event Poster / Banner" zone. Uploads to Cloudinary the moment a file is
 * chosen (or dropped) and reports the secure URL through `onChange(url)`.
 * `onBusyChange(true|false)` lets the parent block submission while uploading.
 */
export default function PosterUpload({ value, onChange, onBusyChange, onPreviewChange, disabled = false }) {
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Release local preview blobs and cancel uploads when replaced or unmounted.
  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const setBusy = (busy) => onBusyChange?.(busy);

  const handleFile = async (file) => {
    if (!file || disabled) return;

    const problem = validateImage(file);
    if (problem) {
      setState('error');
      setError(problem);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    // Lets the parent show the poster in its card preview while it uploads.
    onPreviewChange?.(localPreview);
    setError('');
    setState('uploading');
    setBusy(true);

    try {
      const secureUrl = await uploadImage(file, { signal: controller.signal });
      if (controller.signal.aborted) return;
      onChange(secureUrl);
      onPreviewChange?.('');
      setState('done');
    } catch (uploadError) {
      if (uploadError.name === 'AbortError') return;
      console.error('Poster upload error:', uploadError);
      onPreviewChange?.('');
      setState('error');
      setError(uploadError.message || 'Upload failed. Please try again.');
    } finally {
      if (controllerRef.current === controller) setBusy(false);
    }
  };

  const removePoster = () => {
    controllerRef.current?.abort();
    setBusy(false);
    setPreviewUrl('');
    onPreviewChange?.('');
    setError('');
    setState('idle');
    onChange('');
  };

  // Local preview while uploading; otherwise the saved Cloudinary poster.
  const shownImage = previewUrl || (value ? cloudinaryBanner(value, 900) : '');

  return (
    <div
      className={[
        'poster-zone',
        dragActive ? 'is-drag' : '',
        state === 'error' ? 'is-error' : '',
        !isCloudinaryConfigured ? 'is-disabled' : ''
      ].join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        if (isCloudinaryConfigured && !disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (isCloudinaryConfigured) handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="poster-zone-head">
        <span className="poster-zone-title">Upload Event Poster / Banner</span>
        <span className="poster-zone-hint">Optional · JPG, PNG or WebP up to 5 MB · shown at 16:9</span>
      </div>

      <div className={`poster-canvas ${shownImage ? 'has-image' : ''}`}>
        {shownImage ? (
          <img src={shownImage} alt="Event poster preview" />
        ) : (
          <button
            type="button"
            className="poster-empty"
            onClick={() => inputRef.current?.click()}
            disabled={!isCloudinaryConfigured || disabled}
          >
            <CameraIcon width={28} height={28} />
            <span>{isCloudinaryConfigured ? 'Click or drop an image here' : 'Poster uploads are not configured'}</span>
          </button>
        )}

        {state === 'uploading' && (
          <span className="poster-overlay" role="status">
            <span className="spinner spinner-light" />
            Uploading poster...
          </span>
        )}
        {state === 'done' && (
          <span className="poster-badge"><CheckIcon width={14} height={14} /> Uploaded</span>
        )}
      </div>

      {state === 'error' && <p className="poster-error" role="alert">{error}</p>}

      {isCloudinaryConfigured && shownImage && (
        <div className="poster-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || state === 'uploading'}
          >
            <CameraIcon width={16} height={16} />
            Replace Poster
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={removePoster} disabled={disabled}>
            <CloseIcon width={16} height={16} />
            Remove
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
