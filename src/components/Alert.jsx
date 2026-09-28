import { AlertIcon, CheckIcon } from './Icons';

// Styled status box using the global .alert classes (error | info | success | warning).
export default function Alert({ type = 'info', children, className = '' }) {
  return (
    <div className={`alert alert-${type} ${className}`.trim()} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'success' ? <CheckIcon width={18} height={18} /> : <AlertIcon width={18} height={18} />}
      <span>{children}</span>
    </div>
  );
}
