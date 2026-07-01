import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, children, type, ...rest },
  ref,
) {
  const classes = [styles["btn"], className].filter(Boolean).join(" ");

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {children}
    </button>
  );
});
