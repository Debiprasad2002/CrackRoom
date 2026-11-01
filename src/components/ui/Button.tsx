import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary: 'bg-violet-500 text-white hover:bg-violet-600 shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset]',
  secondary: 'border border-line-strong bg-ink-700 text-fg hover:border-ink-500 hover:bg-ink-600',
  ghost: 'text-fg-muted hover:bg-ink-700 hover:text-fg',
  danger: 'border border-rose-400/30 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20',
};

const sizes: Record<Size, string> = {
  // Compact for mouse users; finger-sized (40px) on touch screens.
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-3.5',
  md: 'h-10 px-4 text-sm [&_svg]:size-4',
  lg: 'h-12 px-5 text-[15px] [&_svg]:size-[18px]',
  icon: 'size-10 [&_svg]:size-[18px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className as string)} {...props} />;
}
