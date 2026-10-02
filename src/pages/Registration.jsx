import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import SearchableSelect from '../components/SearchableSelect';
import { CameraIcon, CheckIcon, CloseIcon, LockIcon } from '../components/Icons';
import {
  ACADEMIC_LEVELS,
  HOUSE_NUMBER_MAX,
  MINISTRY_WINGS,
  RESIDENTIAL_AREAS,
  YEAR_OPTIONS,
  coursesForLevel
} from '../data/constants';
import {
  ACCEPTED_IMAGE_TYPES,
  isCloudinaryConfigured,
  uploadImage,
  validateImage
} from '../lib/cloudinary';

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  accessLevel: 'member', // Default level
  academicLevel: '',
  yearOfStudy: '1',
  courseCode: '',
  residentialArea: '',
  houseNumber: '',
  ministryWing: 'None',
  leaderPasscode: '' // only used for the client-side check; never saved to Firestore
};

const LEADER_AUTH_ERROR =
  'Authorization Failed: Invalid Leader Passcode. Please verify with the Church Secretariat.';

// Client-side leader key check. NOTE: both values are compiled into the public
// JavaScript bundle, so they are readable by anyone who inspects the site.
const LEADER_REGISTRATION_KEY = (import.meta.env.VITE_LEADER_REGISTRATION_KEY ?? '').trim();
const LEADER_FALLBACK_KEY = 'TucasaMbeya2026';

const isValidLeaderPasscode = (typed) => {
  const passcode = (typed ?? '').trim();
  if (!passcode) return false;
  return (LEADER_REGISTRATION_KEY !== '' && passcode === LEADER_REGISTRATION_KEY) || passcode === LEADER_FALLBACK_KEY;
};

const getFriendlyError = (error) => {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in or use a different email.';
    case 'auth/invalid-email':
      return 'The email address is not valid. Please check it and try again.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Network connection lost. Please check your internet and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password registration is not enabled for this portal. Please contact the church leaders.';
    case 'permission-denied':
      return 'Your profile could not be saved (permission denied). Please contact the church leaders.';
    default:
      return 'Registration failed due to an unexpected error. Please try again.';
  }
};

export default function Registration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile picture (uploaded to Cloudinary the moment it is selected)
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | done | error
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const uploadControllerRef = useRef(null);

  // Release the local preview blob when it is replaced or the page unmounts.
  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Cancel an in-flight upload if the student leaves the page.
  useEffect(() => () => uploadControllerRef.current?.abort(), []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Switching away from "Leader" discards any typed passcode.
      ...(name === 'accessLevel' && value !== 'leader' ? { leaderPasscode: '' } : {}),
      // Each qualification level has its own course list — clear a course from another level.
      ...(name === 'academicLevel' && !coursesForLevel(value).some((c) => c.code === prev.courseCode)
        ? { courseCode: '' }
        : {})
    }));
  };

  const levelCourses = coursesForLevel(formData.academicLevel);
  const isLeaderSignup = formData.accessLevel === 'leader';

  const setField = (name) => (value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFile = async (file) => {
    if (!file) return;

    const problem = validateImage(file);
    if (problem) {
      setUploadState('error');
      setUploadError(problem);
      return;
    }

    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;

    setPreviewUrl(URL.createObjectURL(file));
    setProfilePictureUrl('');
    setUploadError('');
    setUploadState('uploading');

    try {
      const secureUrl = await uploadImage(file, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setProfilePictureUrl(secureUrl);
      setUploadState('done');
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Profile picture upload error:', error);
      setUploadState('error');
      setUploadError(error.message || 'Upload failed. Please try again.');
    }
  };

  const handleFileInput = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!isCloudinaryConfigured || loading) return;
    handleFile(e.dataTransfer.files?.[0]);
  };

  const removePhoto = () => {
    uploadControllerRef.current?.abort();
    setProfilePictureUrl('');
    setPreviewUrl('');
    setUploadError('');
    setUploadState('idle');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Leader passcode is checked first — a wrong key never reaches Firebase Auth.
    if (isLeaderSignup && !isValidLeaderPasscode(formData.leaderPasscode)) {
      setMessage({ type: 'error', text: LEADER_AUTH_ERROR });
      return;
    }

    if (uploadState === 'uploading') {
      setMessage({ type: 'info', text: 'Please wait for your profile picture to finish uploading.' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    if (!formData.academicLevel) {
      setMessage({ type: 'error', text: 'Please select your academic qualification level.' });
      return;
    }

    const selectedCourse = levelCourses.find((course) => course.code === formData.courseCode);
    if (!selectedCourse) {
      setMessage({ type: 'error', text: 'Please select your course.' });
      return;
    }

    if (!formData.residentialArea) {
      setMessage({ type: 'error', text: 'Please select your Mbeya residential area.' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Creating your account...' });

    let createdUser = null;

    try {
      const email = formData.email.trim();
      const { user } = await createUserWithEmailAndPassword(auth, email, formData.password);
      createdUser = user;

      // Profile payload is built field-by-field, so leaderPasscode is never saved.
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: formData.fullName.trim(),
        email,
        phone: formData.phone.trim(),
        role: formData.accessLevel, // 'reader' | 'member' | 'associate' | 'leader' — defaults to 'member'
        // Leaders are active immediately.
        ...(isLeaderSignup ? { status: 'approved' } : {}),
        feeStatus: 'unpaid', // semester ledger: 'unpaid' | 'semester1_paid' | 'fully_paid'
        membershipFeePaid: false, // kept in sync (true only when fully paid)
        profilePictureUrl,
        academicDetails: {
          level: formData.academicLevel, // 'certificate' | 'diploma' | 'degree'
          courseCode: selectedCourse.code, // e.g. 'BAC'
          course: selectedCourse.name, // e.g. 'Bachelor in Accountancy'
          yearOfStudy: formData.yearOfStudy
        },
        location: {
          residentialArea: formData.residentialArea,
          houseNumber: formData.houseNumber.trim()
        },
        ministryWing: formData.ministryWing,
        createdAt: serverTimestamp()
      });

      setFormData((prev) => ({ ...prev, leaderPasscode: '' }));

      // Accounts are active immediately — leaders land in the Command Center, everyone
      // else in their personal workspace.
      navigate(isLeaderSignup ? '/leader' : '/dashboard', { replace: true });
    } catch (error) {
      console.error('Registration error:', error);

      // Roll back the auth account if the profile document failed to save,
      // so the student can retry with the same email.
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      setMessage({ type: 'error', text: getFriendlyError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tucasa-register-container">
      <style>{`
        .tucasa-register-container {
          font-family: 'Nunito', sans-serif;
          min-height: 100vh;
          background: #f4f7f9;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
          box-sizing: border-box;
        }

        .tucasa-card {
          background: #ffffff;
          width: 100%;
          max-width: 650px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border-radius: 4px;
          overflow: hidden;
        }

        .tucasa-header {
          background: linear-gradient(135deg, #0f2b46 0%, #1a446c 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
          border-bottom: 3px solid #d4af37;
        }

        .tucasa-header h2 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .tucasa-header p {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #cbd5e1;
        }

        .tucasa-form {
          padding: 35px;
        }

        .form-section-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
          margin: 20px 0 15px 0;
          font-weight: 700;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 5px;
        }

        .form-section-title:first-of-type {
          margin-top: 0;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group select {
          font-family: 'Nunito', sans-serif;
          height: 42px;
          padding: 0 12px;
          font-size: 15px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background-color: #ffffff;
          color: #1e293b;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          border-color: #1a446c;
          box-shadow: 0 0 0 3px rgba(26, 68, 108, 0.15);
        }

        .alert-box {
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 20px;
          font-weight: 600;
        }

        .alert-box.error {
          background-color: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
        }

        .alert-box.info {
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
        }

        .alert-box.success {
          background-color: #f0fdf4;
          color: #15803d;
          border: 1px solid #dcfce7;
        }

        .submit-btn {
          font-family: 'Nunito', sans-serif;
          width: 100%;
          height: 46px;
          background-color: #1a446c;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-top: 15px;
        }

        .submit-btn:hover {
          background-color: #0f2b46;
        }

        .submit-btn:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }

        .form-group .ss {
          --ss-height: 42px;
        }

        .form-group select:disabled {
          background-color: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }

        /* ---------- Profile picture upload zone ---------- */
        .upload-zone {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 18px;
          margin-bottom: 24px;
          border: 1.5px dashed #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
        }

        .upload-zone.is-drag {
          border-color: #1a446c;
          background: #eef3f8;
          box-shadow: 0 0 0 3px rgba(26, 68, 108, 0.12);
        }

        .upload-zone.is-done {
          border-style: solid;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .upload-zone.is-error {
          border-color: #fecaca;
          background: #fef2f2;
        }

        .upload-zone.is-disabled {
          opacity: 0.75;
        }

        .upload-avatar {
          position: relative;
          flex-shrink: 0;
          width: 84px;
          height: 84px;
          border-radius: 50%;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #0f2b46 0%, #1a446c 100%);
          border: 3px solid #d4af37;
          color: #d4af37;
          box-shadow: 0 6px 16px -6px rgba(15, 43, 70, 0.4);
        }

        .upload-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .upload-avatar-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(15, 43, 70, 0.55);
        }

        .upload-spinner {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          animation: upload-spin 0.8s linear infinite;
        }

        @keyframes upload-spin {
          to { transform: rotate(360deg); }
        }

        .upload-badge {
          position: absolute;
          right: 2px;
          bottom: 2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #15803d;
          color: #ffffff;
          border: 2px solid #ffffff;
        }

        .upload-body {
          flex: 1;
          min-width: 0;
        }

        .upload-title {
          font-size: 15px;
          font-weight: 800;
          color: #0f2b46;
          margin: 0 0 2px;
        }

        .upload-hint {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 12px;
        }

        .upload-status {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 12px;
        }

        .upload-status.is-done { color: #15803d; }
        .upload-status.is-error { color: #b91c1c; }
        .upload-status.is-uploading { color: #1d4ed8; }

        .upload-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .upload-btn {
          font-family: 'Nunito', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s, border-color 0.2s, color 0.2s;
        }

        .upload-btn-primary {
          background: #1a446c;
          color: #ffffff;
          border: 1px solid #1a446c;
        }

        .upload-btn-primary:hover {
          background: #0f2b46;
        }

        .upload-btn-ghost {
          background: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .upload-btn-ghost:hover {
          border-color: #b91c1c;
          color: #b91c1c;
        }

        .upload-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        /* ---------- Leader verification (slides open) ---------- */
        .leader-key {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 0.35s ease, opacity 0.25s ease, margin 0.35s ease;
        }

        .leader-key.is-open {
          grid-template-rows: 1fr;
          opacity: 1;
          margin-bottom: 20px;
        }

        .leader-key-inner {
          overflow: hidden;
          min-height: 0;
        }

        .leader-key-panel {
          padding: 16px 16px 0;
          border: 1px solid #1a446c;
          border-left: 4px solid #d4af37;
          border-radius: 4px;
          background: linear-gradient(135deg, #f8fafc 0%, #eef3f8 100%);
        }

        .leader-key-head {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .leader-key-head strong {
          display: block;
          font-size: 14px;
          color: #0f2b46;
        }

        .leader-key-head span {
          font-size: 13px;
          color: #64748b;
        }

        .leader-key-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: linear-gradient(135deg, #0f2b46 0%, #1a446c 100%);
          color: #d4af37;
        }

        .leader-key .form-group input {
          letter-spacing: 0.08em;
        }

        @media (prefers-reduced-motion: reduce) {
          .leader-key {
            transition: none;
          }
        }

        .login-link {
          margin-top: 20px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }

        .login-link a {
          color: #1a446c;
          font-weight: 700;
          text-decoration: none;
        }

        .login-link a:hover {
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .grid-2 {
            grid-template-columns: 1fr;
            gap: 0;
          }
          .tucasa-form {
            padding: 20px;
          }
          .upload-zone {
            flex-direction: column;
            text-align: center;
          }
          .upload-actions {
            justify-content: center;
          }
        }
      `}</style>

      <div className="tucasa-card">
        <div className="tucasa-header">
          <h2>TUCASA TIA MBEYA</h2>
          <p>Student Church Member Portal Registration</p>
        </div>

        <form onSubmit={handleSubmit} className="tucasa-form">
          {message.text && (
            <div className={`alert-box ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
              {message.text}
            </div>
          )}

          <div
            className={[
              'upload-zone',
              dragActive ? 'is-drag' : '',
              uploadState === 'done' ? 'is-done' : '',
              uploadState === 'error' ? 'is-error' : '',
              isCloudinaryConfigured ? '' : 'is-disabled'
            ].join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              if (isCloudinaryConfigured) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="upload-avatar">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected profile picture preview" />
              ) : (
                <CameraIcon width={30} height={30} />
              )}
              {uploadState === 'uploading' && (
                <span className="upload-avatar-overlay"><span className="upload-spinner" /></span>
              )}
              {uploadState === 'done' && (
                <span className="upload-badge"><CheckIcon width={13} height={13} /></span>
              )}
            </div>

            <div className="upload-body">
              <p className="upload-title">Upload Profile Picture</p>

              {!isCloudinaryConfigured ? (
                <p className="upload-hint">Photo uploads are not available right now. You can register without one.</p>
              ) : uploadState === 'uploading' ? (
                <p className="upload-status is-uploading" role="status">Uploading your photo...</p>
              ) : uploadState === 'done' ? (
                <p className="upload-status is-done" role="status">Photo uploaded successfully.</p>
              ) : uploadState === 'error' ? (
                <p className="upload-status is-error" role="alert">{uploadError}</p>
              ) : (
                <p className="upload-hint">Optional · JPG, PNG or WebP up to 5 MB. Drag & drop or browse.</p>
              )}

              {isCloudinaryConfigured && (
                <div className="upload-actions">
                  <button
                    type="button"
                    className="upload-btn upload-btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || uploadState === 'uploading'}
                  >
                    <CameraIcon width={16} height={16} />
                    {previewUrl ? 'Change Photo' : 'Choose Photo'}
                  </button>
                  {previewUrl && (
                    <button
                      type="button"
                      className="upload-btn upload-btn-ghost"
                      onClick={removePhoto}
                      disabled={loading}
                    >
                      <CloseIcon width={16} height={16} />
                      Remove
                    </button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                className="upload-input"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleFileInput}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="form-section-title">Personal Details</div>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 0712345678"
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create password"
                minLength={6}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat password"
                required
              />
            </div>
          </div>

          <div className="form-section-title">Church & Campus Details</div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="reg-access">Registration Access Level</label>
              <select id="reg-access" name="accessLevel" value={formData.accessLevel} onChange={handleChange}>
                <option value="reader">Reader (Visitor / Network)</option>
                <option value="member">Member (Active Student)</option>
                <option value="associate">Associate (Alumni / Supporter)</option>
                <option value="leader">Leader (Church Leadership)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="reg-ministry">Ministry Wing / Choir</label>
              <select id="reg-ministry" name="ministryWing" value={formData.ministryWing} onChange={handleChange}>
                {MINISTRY_WINGS.map((wing) => (
                  <option key={wing.value} value={wing.value}>{wing.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slides open only when "Leader" is selected. */}
          <div className={`leader-key ${isLeaderSignup ? 'is-open' : ''}`} aria-hidden={!isLeaderSignup}>
            <div className="leader-key-inner">
              <div className="leader-key-panel">
                <div className="leader-key-head">
                  <span className="leader-key-icon"><LockIcon width={16} height={16} /></span>
                  <div>
                    <strong>Leadership verification required</strong>
                    <span>Leader accounts get full Command Center access immediately.</span>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="reg-leader-key">Leader Verification Passcode</label>
                  <input
                    id="reg-leader-key"
                    type="password"
                    name="leaderPasscode"
                    value={formData.leaderPasscode}
                    onChange={handleChange}
                    placeholder="Enter official leader key"
                    autoComplete="off"
                    maxLength={200}
                    disabled={!isLeaderSignup}
                    tabIndex={isLeaderSignup ? 0 : -1}
                    required={isLeaderSignup}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section-title">Academic Details</div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="reg-level">Academic Qualification Level</label>
              <select id="reg-level" name="academicLevel" value={formData.academicLevel} onChange={handleChange} required>
                <option value="" disabled>Select your level</option>
                {ACADEMIC_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="reg-year">Year of Study</label>
              <select id="reg-year" name="yearOfStudy" value={formData.yearOfStudy} onChange={handleChange}>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year.value} value={year.value}>{year.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-course">Course</label>
            <select
              id="reg-course"
              name="courseCode"
              value={formData.courseCode}
              onChange={handleChange}
              disabled={!formData.academicLevel}
              required
            >
              <option value="" disabled>
                {formData.academicLevel ? 'Select your course' : 'Select your qualification level first'}
              </option>
              {levelCourses.map((course) => (
                <option key={course.code} value={course.code}>{course.code} — {course.name}</option>
              ))}
            </select>
          </div>

          <div className="form-section-title">Mbeya Residence</div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="reg-area">Mbeya Residential Area</label>
              <SearchableSelect
                id="reg-area"
                name="residentialArea"
                value={formData.residentialArea}
                onChange={setField('residentialArea')}
                options={RESIDENTIAL_AREAS}
                placeholder="Select your area"
                searchPlaceholder="Search areas..."
                emptyText="No area matches your search"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-house">House Number / Hostel Block</label>
              <input
                id="reg-house"
                type="text"
                name="houseNumber"
                value={formData.houseNumber}
                onChange={handleChange}
                maxLength={HOUSE_NUMBER_MAX}
                placeholder="e.g. Nyumba Na. 23 or Hostel Block B, Room 12"
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading || uploadState === 'uploading'}>
            {loading ? 'Creating account...' : uploadState === 'uploading' ? 'Uploading photo...' : 'Create Account'}
          </button>

          <p className="login-link">
            Already registered? <Link to="/login">Sign in</Link> · <Link to="/">Back to home</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
