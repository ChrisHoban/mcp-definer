import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

import styles from './ui.module.css';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[`button-${variant}`]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.input} ${className}`} {...props} />;
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.textarea} ${className}`} {...props} />;
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${styles.select} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

export function Alert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return (
    <div className={`${styles.alert} ${styles[`alert-${variant}`]}`} role="alert">
      {children}
    </div>
  );
}

export function Badge({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <span className={`${styles.badge} ${styles[`badge-${variant}`]}`}>{children}</span>;
}

export function Spinner() {
  return <span className={styles.spinner} aria-label="Loading" role="status" />;
}
