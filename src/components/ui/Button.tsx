import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/util';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
  success:
    'btn border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-4 py-2.5 text-sm rounded-2xl',
  lg: 'px-6 py-3 text-[15px] rounded-2xl',
  xl: 'px-8 py-4 text-base rounded-3xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'ghost', size = 'md', loading, icon, children, block, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(variants[variant], sizes[size], block && 'w-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});
