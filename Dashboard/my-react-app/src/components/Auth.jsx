import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineSparkles,
  HiOutlineUser,
  HiOutlineWifi,
} from 'react-icons/hi2';
import PasswordResetFlow from './PasswordResetFlow';
import { login, register } from '../services/authService';
import { notify } from '../utils/notify';

const fieldIds = {
  name: 'auth-name',
  emailOrPhone: 'auth-email-or-phone',
  phone: 'auth-phone',
  password: 'auth-password',
  confirmPassword: 'auth-confirm-password',
  address: 'auth-address',
  country: 'auth-country',
  state: 'auth-state',
  district: 'auth-district',
  city: 'auth-city',
  village: 'auth-village',
  street: 'auth-street',
  pincode: 'auth-pincode',
};

const emptyLocation = {
  address: '',
  country: '',
  state: '',
  district: '',
  city: '',
  village: '',
  street: '',
  pincode: '',
  latitude: '',
  longitude: '',
};

const fetchLocationSuggestions = async (query) => {
  if (!query || query.trim().length < 8) {
    return [];
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data)
    ? data.map((item) => ({
      label: item.display_name,
      address: item.address || {},
      latitude: item.lat,
      longitude: item.lon,
    }))
    : [];
};

const toLocationFields = (candidate = {}) => ({
  address: candidate.label || '',
  country: candidate.address?.country || '',
  state: candidate.address?.state || '',
  district: candidate.address?.state_district || candidate.address?.county || '',
  city: candidate.address?.city || candidate.address?.town || candidate.address?.village || '',
  village: candidate.address?.village || '',
  street: [candidate.address?.house_number, candidate.address?.road].filter(Boolean).join(' '),
  pincode: candidate.address?.postcode || '',
  latitude: candidate.latitude || '',
  longitude: candidate.longitude || '',
});

const Auth = ({ onLogin, initialMode = 'login' }) => {
  const rememberedEmail = typeof window !== 'undefined' ? localStorage.getItem('rememberedEmail') || '' : '';
  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [registerStep, setRegisterStep] = useState(1);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetFlow, setShowResetFlow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [locationState, setLocationState] = useState('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const searchTimer = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    emailOrPhone: rememberedEmail,
    phone: '',
    password: '',
    confirmPassword: '',
    ...emptyLocation,
  });

  useEffect(() => {
    setIsLogin(initialMode !== 'register');
    setRegisterStep(1);
    setShowResetFlow(false);
    setSubmitAttempted(false);
    setTouched({});
    setStatusMessage('');
    setLocationMessage('');
  }, [initialMode]);

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedEmail');
    if (remembered) {
      setFormData((current) => ({ ...current, emailOrPhone: remembered }));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (isLogin || registerStep !== 2) {
      setSuggestions([]);
      return undefined;
    }

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    searchTimer.current = window.setTimeout(async () => {
      try {
        setSuggestions(await fetchLocationSuggestions(locationQuery));
      } catch {
        setSuggestions([]);
      }
    }, 300); 

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [isLogin, locationQuery, registerStep]);

  const validation = useMemo(() => {
    const errors = {};

    if (!formData.emailOrPhone.trim()) errors.emailOrPhone = 'Email or phone is required.';
    if (!formData.password.trim() || formData.password.trim().length < 8) errors.password = 'Password must contain at least 8 characters.';

    if (!isLogin) {
      if (!formData.name.trim()) errors.name = 'Full name is required.';
      if (!/^\+?[0-9][0-9\s()-]{7,}$/.test(formData.phone.trim())) errors.phone = 'Enter a valid phone number.';
      if (registerStep === 1 && formData.confirmPassword.trim() !== formData.password.trim()) errors.confirmPassword = 'Passwords do not match.';
      if (registerStep === 2) {
        if (!formData.country.trim()) errors.country = 'Country is required.';
        if (!formData.state.trim()) errors.state = 'State is required.';
        if (!formData.district.trim()) errors.district = 'District is required.';
        if (!formData.city.trim()) errors.city = 'City is required.';
        if (!formData.pincode.trim()) errors.pincode = 'PIN code is required.';
        if (!formData.street.trim()) errors.street = 'Street address is required.';
      }
    }

    return errors;
  }, [formData, isLogin, registerStep]);

  if (showResetFlow) {
    return <PasswordResetFlow onBack={() => setShowResetFlow(false)} />;
  }

  const setMessage = (text, type = 'info') => {
    setStatusMessage(text);
    if (text) {
      notify(text, type);
    }
  };

  const isFieldInvalid = (fieldName) => Boolean((submitAttempted || touched[fieldName]) && validation[fieldName]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
  };

  const handlePasswordKey = (event) => {
    setCapsLockOn(Boolean(event.getModifierState && event.getModifierState('CapsLock')));
  };

  const applySuggestion = (suggestion) => {
    setFormData((current) => ({ ...current, ...toLocationFields(suggestion) }));
    setLocationQuery(suggestion.label || '');
    setSuggestions([]);
    setLocationMessage('Address suggestion applied.');
    setLocationState('success');
  };

  const applyReverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
      if (!response.ok) throw new Error('Reverse geocode failed');

      const data = await response.json();
      const address = data.address || {};
      setFormData((current) => ({
        ...current,
        address: data.display_name || current.address,
        country: address.country || current.country,
        state: address.state || current.state,
        district: address.state_district || address.county || current.district,
        city: address.city || address.town || address.village || current.city,
        village: address.village || current.village,
        street: [address.house_number, address.road].filter(Boolean).join(' ') || current.street,
        pincode: address.postcode || current.pincode,
        latitude: String(latitude),
        longitude: String(longitude),
      }));
      setLocationMessage('Current location applied successfully.');
      setLocationState('success');
    } catch {
      setFormData((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
      setLocationMessage('Location detected, but address details need manual entry.');
      setLocationState('error');
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location services are not available in this browser.');
      setLocationState('error');
      return;
    }

    setLocationState('loading');
    setLocationMessage('Detecting your current address...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        applyReverseGeocode(latitude, longitude);
      },
      () => {
        setLocationState('error');
        setLocationMessage('Permission denied. You can enter the address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSwitchMode = (mode) => {
    setIsLogin(mode === 'login');
    setRegisterStep(1);
    setSubmitAttempted(false);
    setTouched({});
    setStatusMessage('');
    setLocationMessage('');
    setSuggestions([]);
  };

  const goNext = () => {
    setSubmitAttempted(true);
    const hasStepOneErrors = ['name', 'phone', 'emailOrPhone', 'password', 'confirmPassword'].some((key) => validation[key]);
    if (hasStepOneErrors) {
      setMessage('Complete the required fields before moving to step 2.', 'warning');
      return;
    }

    setRegisterStep(2);
    setSubmitAttempted(false);
    setTouched({});
  };

  const goBack = () => {
    setRegisterStep(1);
    setSubmitAttempted(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);

    if (isLogin) {
      if (validation.emailOrPhone || validation.password) {
        setMessage('Please review the highlighted fields before continuing.', 'warning');
        return;
      }
    } else if (registerStep === 1) {
      goNext();
      return;
    } else if (Object.keys(validation).length > 0) {
      setMessage('Please review the highlighted fields before continuing.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const loginIdentifier = formData.emailOrPhone.trim();
      const payload = isLogin
        ? { email: loginIdentifier, password: formData.password }
        : {
            name: formData.name,
            email: loginIdentifier,
            phone: formData.phone,
            password: formData.password,
            location: {
              address: formData.address,
              country: formData.country,
              state: formData.state,
              district: formData.district,
              city: formData.city,
              village: formData.village,
              street: formData.street,
              pincode: formData.pincode,
              latitude: formData.latitude,
              longitude: formData.longitude,
            },
          };

      const response = isLogin ? await login(payload) : await register(payload);
      setMessage(response.data.message || 'Success', 'success');

      if (isLogin && response.data.token) {
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', formData.emailOrPhone);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        onLogin();
      } else if (!isLogin) {
        setIsLogin(true);
        setRegisterStep(1);
        setFormData({ name: '', emailOrPhone: formData.emailOrPhone, phone: '', password: '', confirmPassword: '', ...emptyLocation });
        setTouched({});
        setSubmitAttempted(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Authentication failed. Please try again.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card-shell">
      <div className="auth-card-topline">
        <div className="auth-brand-line auth-card-brand-line">
          <div className="auth-brand-mark" aria-hidden="true">PE</div>
          <div>
            <div className="auth-company-name">Pearry ERP Enterprise</div>
            <div className="auth-company-subtitle">Commercial Operations Platform</div>
          </div>
          <div className="auth-version-chip">Enterprise Edition v4.2</div>
        </div>

        <div className="auth-mode-switch auth-mode-switch-compact" role="tablist" aria-label="Authentication mode">
          <button type="button" className={`auth-mode-btn ${isLogin ? 'active' : ''}`} onClick={() => handleSwitchMode('login')} aria-pressed={isLogin}>Login</button>
          <button type="button" className={`auth-mode-btn ${!isLogin ? 'active' : ''}`} onClick={() => handleSwitchMode('register')} aria-pressed={!isLogin}>Register</button>
        </div>
      </div>

      {!isLogin && (
        <div className="auth-progress" aria-label={`Registration step ${registerStep} of 2`}>
          <div className="auth-progress-text">Step {registerStep} of 2</div>
          <div className="auth-progress-track" aria-hidden="true">
            <span className={`auth-progress-dot ${registerStep >= 1 ? 'active' : ''}`} />
            <span className={`auth-progress-line ${registerStep >= 2 ? 'active' : ''}`} />
            <span className={`auth-progress-dot ${registerStep >= 2 ? 'active' : ''}`} />
          </div>
        </div>
      )}

      <div className="auth-card-header">
        <div className="auth-card-kicker">{isLogin ? 'Secure enterprise access' : `Registration step ${registerStep} of 2`}</div>
        <h2>{isLogin ? 'Sign in to the ERP control plane' : registerStep === 1 ? 'Create your account' : 'Complete your location'}</h2>
        <p>{isLogin ? 'Use your email or phone number to access the platform.' : registerStep === 1 ? 'We only ask for the essentials first.' : 'Add the address used for onboarding, billing, or delivery.'}</p>
      </div>

      {statusMessage && <div className="auth-status-banner" role="status" aria-live="polite">{statusMessage}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {isLogin && (
          <>
            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.emailOrPhone}>Email / Phone</label>
              <div className={`auth-field ${isFieldInvalid('emailOrPhone') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineEnvelope /></span>
                <input id={fieldIds.emailOrPhone} type="text" name="emailOrPhone" autoComplete="username" value={formData.emailOrPhone} onChange={handleChange} onBlur={handleBlur} placeholder="name@company.com or +91 98765 43210" aria-invalid={isFieldInvalid('emailOrPhone')} required />
              </div>
              {isFieldInvalid('emailOrPhone') && <div className="auth-field-feedback">{validation.emailOrPhone}</div>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.password}>Password</label>
              <div className={`auth-field auth-field-password ${isFieldInvalid('password') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineLockClosed /></span>
                <input id={fieldIds.password} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" value={formData.password} onChange={handleChange} onBlur={handleBlur} onKeyUp={handlePasswordKey} onKeyDown={handlePasswordKey} onFocus={handlePasswordKey} placeholder="Enter your password" aria-invalid={isFieldInvalid('password')} aria-describedby={isFieldInvalid('password') ? 'auth-password-error' : capsLockOn ? 'auth-password-caps' : undefined} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <HiOutlineEyeSlash aria-hidden="true" /> : <HiOutlineEye aria-hidden="true" />}</button>
              </div>
              {capsLockOn && <div className="auth-field-hint" id="auth-password-caps">Caps Lock is on.</div>}
              {isFieldInvalid('password') && <div className="auth-field-feedback" id="auth-password-error">{validation.password}</div>}
            </div>

            <div className="auth-form-row">
              <label className="auth-remember">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-link-button" onClick={() => setShowResetFlow(true)}>Forgot password?</button>
            </div>

            <div className="auth-login-note">
              <HiOutlineWifi />
              <span>SSO will be available in a future release.</span>
            </div>

            <button type="submit" className="auth-submit-btn auth-submit-login" disabled={isSubmitting}>
              <span className="auth-submit-label">Login</span>
              {isSubmitting ? <span className="auth-spinner" aria-hidden="true" /> : <HiOutlineArrowRight aria-hidden="true" />}
            </button>

            <div className="auth-assurance-grid">
              <div className="auth-assurance-card"><HiOutlineCheckCircle /><span>Fast session handoff into the ERP shell.</span></div>
              <div className="auth-assurance-card"><HiOutlineSparkles /><span>Secure token handling with refresh support.</span></div>
              <div className="auth-assurance-card"><HiOutlineWifi /><span>Remember me keeps trusted devices signed in.</span></div>
            </div>
          </>
        )}

        {!isLogin && registerStep === 1 && (
          <>
            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.name}>Full name</label>
              <div className={`auth-field ${isFieldInvalid('name') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineUser /></span>
                <input id={fieldIds.name} type="text" name="name" autoComplete="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} placeholder="Aarav Mehta" aria-invalid={isFieldInvalid('name')} required />
              </div>
              {isFieldInvalid('name') && <div className="auth-field-feedback">{validation.name}</div>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.phone}>Phone</label>
              <div className={`auth-field ${isFieldInvalid('phone') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlinePhone /></span>
                <input id={fieldIds.phone} type="tel" name="phone" autoComplete="tel" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="+91 90000 12345" aria-invalid={isFieldInvalid('phone')} required />
              </div>
              {isFieldInvalid('phone') && <div className="auth-field-feedback">{validation.phone}</div>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.emailOrPhone}>Email</label>
              <div className={`auth-field ${isFieldInvalid('emailOrPhone') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineEnvelope /></span>
                <input id={fieldIds.emailOrPhone} type="email" name="emailOrPhone" autoComplete="email" value={formData.emailOrPhone} onChange={handleChange} onBlur={handleBlur} placeholder="name@company.com" aria-invalid={isFieldInvalid('emailOrPhone')} required />
              </div>
              {isFieldInvalid('emailOrPhone') && <div className="auth-field-feedback">{validation.emailOrPhone}</div>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.password}>Password</label>
              <div className={`auth-field auth-field-password ${isFieldInvalid('password') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineLockClosed /></span>
                <input id={fieldIds.password} type={showPassword ? 'text' : 'password'} name="password" autoComplete="new-password" value={formData.password} onChange={handleChange} onBlur={handleBlur} onKeyUp={handlePasswordKey} onKeyDown={handlePasswordKey} onFocus={handlePasswordKey} placeholder="Create a password" aria-invalid={isFieldInvalid('password')} aria-describedby={isFieldInvalid('password') ? 'auth-password-error' : capsLockOn ? 'auth-password-caps' : undefined} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <HiOutlineEyeSlash aria-hidden="true" /> : <HiOutlineEye aria-hidden="true" />}</button>
              </div>
              {capsLockOn && <div className="auth-field-hint" id="auth-password-caps">Caps Lock is on.</div>}
              {isFieldInvalid('password') && <div className="auth-field-feedback" id="auth-password-error">{validation.password}</div>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={fieldIds.confirmPassword}>Confirm password</label>
              <div className={`auth-field auth-field-password ${isFieldInvalid('confirmPassword') ? 'invalid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineLockClosed /></span>
                <input id={fieldIds.confirmPassword} type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur} placeholder="Confirm password" aria-invalid={isFieldInvalid('confirmPassword')} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>{showConfirmPassword ? <HiOutlineEyeSlash aria-hidden="true" /> : <HiOutlineEye aria-hidden="true" />}</button>
              </div>
              {isFieldInvalid('confirmPassword') && <div className="auth-field-feedback">{validation.confirmPassword}</div>}
            </div>

            <div className="auth-form-note auth-form-note-compact">Step 2 will collect the location details used across the ERP.</div>

            <div className="auth-step-actions">
              <button type="button" className="auth-secondary-btn" onClick={() => handleSwitchMode('login')}>Cancel</button>
              <button type="button" className="auth-submit-btn auth-submit-secondary" onClick={goNext}>
                <span className="auth-submit-label">Next</span>
                <HiOutlineArrowRight aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {!isLogin && registerStep === 2 && (
          <div className="auth-location-box auth-location-step">
            <button type="button" className={`auth-location-card ${locationState}`} onClick={useCurrentLocation}>
              <span className="auth-location-card-icon" aria-hidden="true">
                {locationState === 'loading' ? <span className="auth-location-spinner" /> : locationState === 'success' ? <HiOutlineCheckCircle /> : <HiOutlineMapPin />}
              </span>
              <span>
                <strong>Use Current Location</strong>
                <small>{locationState === 'loading' ? 'Detecting your address...' : locationMessage || 'Automatically detect your address'}</small>
              </span>
            </button>

            <div className="auth-location-search">
              <label className="auth-label" htmlFor="auth-location-search">Location autocomplete</label>
              <div className="auth-field">
                <span className="auth-field-icon" aria-hidden="true"><HiOutlineGlobeAlt /></span>
                <input id="auth-location-search" type="text" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Search by city, district, or street" />
              </div>
              {suggestions.length > 0 && (
                <div className="auth-suggestion-list">
                  {suggestions.map((item) => (
                    <button type="button" key={item.label} className="auth-suggestion-item" onClick={() => applySuggestion(item)} title={item.label}>
                      <strong>{item.label}</strong>
                      <span>Autofill address fields</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="auth-location-grid auth-location-grid-step2">
              <div className="auth-field-group auth-field-span-2">
                <label className="auth-label" htmlFor={fieldIds.address}>Street address</label>
                <div className="auth-field">
                  <span className="auth-field-icon" aria-hidden="true"><HiOutlineMapPin /></span>
                  <input id={fieldIds.address} type="text" name="address" value={formData.address} onChange={handleChange} placeholder="House, street, landmark" />
                </div>
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.country}>Country</label>
                <div className={`auth-field ${isFieldInvalid('country') ? 'invalid' : ''}`}><input id={fieldIds.country} type="text" name="country" value={formData.country} onChange={handleChange} onBlur={handleBlur} placeholder="Country" aria-invalid={isFieldInvalid('country')} /></div>
                {isFieldInvalid('country') && <div className="auth-field-feedback">{validation.country}</div>}
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.state}>State</label>
                <div className={`auth-field ${isFieldInvalid('state') ? 'invalid' : ''}`}><input id={fieldIds.state} type="text" name="state" value={formData.state} onChange={handleChange} onBlur={handleBlur} placeholder="State" aria-invalid={isFieldInvalid('state')} /></div>
                {isFieldInvalid('state') && <div className="auth-field-feedback">{validation.state}</div>}
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.district}>District</label>
                <div className={`auth-field ${isFieldInvalid('district') ? 'invalid' : ''}`}><input id={fieldIds.district} type="text" name="district" value={formData.district} onChange={handleChange} onBlur={handleBlur} placeholder="District" aria-invalid={isFieldInvalid('district')} /></div>
                {isFieldInvalid('district') && <div className="auth-field-feedback">{validation.district}</div>}
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.city}>City</label>
                <div className={`auth-field ${isFieldInvalid('city') ? 'invalid' : ''}`}><input id={fieldIds.city} type="text" name="city" value={formData.city} onChange={handleChange} onBlur={handleBlur} placeholder="City" aria-invalid={isFieldInvalid('city')} /></div>
                {isFieldInvalid('city') && <div className="auth-field-feedback">{validation.city}</div>}
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.village}>Village</label>
                <div className="auth-field"><input id={fieldIds.village} type="text" name="village" value={formData.village} onChange={handleChange} placeholder="Optional" /></div>
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={fieldIds.pincode}>PIN code</label>
                <div className={`auth-field ${isFieldInvalid('pincode') ? 'invalid' : ''}`}><input id={fieldIds.pincode} type="text" name="pincode" value={formData.pincode} onChange={handleChange} onBlur={handleBlur} placeholder="PIN code" aria-invalid={isFieldInvalid('pincode')} /></div>
                {isFieldInvalid('pincode') && <div className="auth-field-feedback">{validation.pincode}</div>}
              </div>
              <div className="auth-field-group auth-field-span-2">
                <label className="auth-label" htmlFor={fieldIds.street}>Street details</label>
                <div className={`auth-field ${isFieldInvalid('street') ? 'invalid' : ''}`}><input id={fieldIds.street} type="text" name="street" value={formData.street} onChange={handleChange} onBlur={handleBlur} placeholder="House number, street, landmark" aria-invalid={isFieldInvalid('street')} /></div>
                {isFieldInvalid('street') && <div className="auth-field-feedback">{validation.street}</div>}
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor="auth-latitude">Latitude</label>
                <div className="auth-field"><input id="auth-latitude" name="latitude" value={formData.latitude} onChange={handleChange} placeholder="Latitude" /></div>
              </div>
              <div className="auth-field-group">
                <label className="auth-label" htmlFor="auth-longitude">Longitude</label>
                <div className="auth-field"><input id="auth-longitude" name="longitude" value={formData.longitude} onChange={handleChange} placeholder="Longitude" /></div>
              </div>
            </div>

            <div className="auth-location-footer">
              <button type="button" className="auth-secondary-btn" onClick={goBack}>Back</button>
              <button type="submit" className="auth-submit-btn">
                <span className="auth-submit-label">Register</span>
                {isSubmitting ? <span className="auth-spinner" aria-hidden="true" /> : <HiOutlineArrowRight aria-hidden="true" />}
              </button>
            </div>
          </div>
        )}

        <div className="auth-future-ready">Powered by Pearry ERP</div>
      </form>
    </div>
  );
};

export default Auth;
