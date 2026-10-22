import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const variantClass = variant === 'outline' ? styles.outline : styles.primary;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(' ');

  return <button className={classes} {...props} />;
}
